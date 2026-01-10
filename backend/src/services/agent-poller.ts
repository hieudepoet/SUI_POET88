import { getDb } from '../db/database.js';
import { createJob, findAgentsBySkill, getJobById } from '../db/queries.js';
import { LlmAnalyzer } from './llm-analyzer.js';

let pollerInterval: NodeJS.Timeout | null = null;
let isPolling = false;

export function startAgentPolling() {
    if (pollerInterval) return;
    console.log('[AgentPoller] Starting AI Agent service...');
    pollRequests();
    pollerInterval = setInterval(pollRequests, 5000); // Check every 5s
}

export function stopAgentPolling() {
    if (pollerInterval) {
        clearInterval(pollerInterval);
        pollerInterval = null;
    }
}

async function pollRequests() {
    if (isPolling) return;
    isPolling = true;

    try {
        const db = getDb();
        
        // 1. Get pending requests
        const result = await db.query(
            `SELECT * FROM user_requests WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5`
        );
        
        const requests = result.rows;

        if (requests.length > 0) {
            console.log(`[AgentPoller] Found ${requests.length} pending requests`);
            
            for (const req of requests) {
                await processRequest(req);
            }
        }

    } catch (error) {
        console.error('[AgentPoller] Error polling:', error);
    } finally {
        isPolling = false;
    }
}

async function processRequest(req: any) {
    console.log(`[AgentPoller] Processing request #${req.id}: "${req.description}"`);
    const db = getDb();

    try {
        // --- ADVANCED AI LOGIC ---
        // Use LLM Analyzer to understand intent, budget, and required skills
        const analyzer = new LlmAnalyzer();
        const analysis = await analyzer.analyze(req.description);

        console.log(`[AgentPoller] Analysis for #${req.id}:`, analysis);

        const title = analysis.summary;
        const amount = analysis.estimatedBudget;
        // Use the first identified skill, or 'general' if none
        const skill = analysis.skills.length > 0 ? analysis.skills[0] : 'general';

        // Find Agent
        // Try to find agent matching the primary skill
        let agents = await findAgentsBySkill(skill);
        
        // If no agent found for primary skill, try secondary skills if available
        if (agents.length === 0 && analysis.skills.length > 1) {
            for (let i = 1; i < analysis.skills.length; i++) {
                console.log(`[AgentPoller] No agent for ${skill}, trying ${analysis.skills[i]}`);
                agents = await findAgentsBySkill(analysis.skills[i]);
                if (agents.length > 0) break;
            }
        }

        // Fallback to any available agent if still none found
        if (agents.length === 0) {
            console.log('[AgentPoller] No agent with matching skills, falling back to any available agent');
            const allAgentsRes = await db.query('SELECT * FROM agents WHERE is_available = true ORDER BY rating DESC LIMIT 1');
            agents = allAgentsRes.rows as any;
        }

        let selectedAgentId = null;
        if (agents.length > 0) {
            // Pick the higest rated one (already sorted by query)
            selectedAgentId = agents[0].user_id; 
        }

        // Create Job
        console.log(`[AgentPoller] Creating job: ${title} ($${amount}) for Agent ${selectedAgentId || 'NONE'}`);
        
        const job = await createJob(
            title,
            req.user_id,
            amount,
            req.description, // Requirements
            selectedAgentId || undefined
        );

        // Update Request
        await db.query(
            `UPDATE user_requests 
             SET status = 'processed', 
                 job_id = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [job.id, req.id]
        );

        console.log(`[AgentPoller] Request #${req.id} processed -> Job #${job.id}`);

    } catch (error) {
        console.error(`[AgentPoller] Failed to process request #${req.id}:`, error);
        
        // Mark as failed
        await db.query(
            `UPDATE user_requests 
             SET status = 'failed', 
                 error_message = 'AI processing failed',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [req.id]
        );
    }
}
