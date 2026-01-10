
import { getDb } from '../db/database.js';
import { createJob, findAgentsBySkill, getJobById } from '../db/queries.js';

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
        // --- SIMPLE AI LOGIC (MVP) ---
        // Parse intent from description
        const text = req.description.toLowerCase();
        let skill = 'general';
        let amount = 50; // Default budget
        let title = 'General Task';

        // Extract budget (e.g. "for $500" or "500 usdc")
        const moneyMatch = text.match(/(\$|usdc\s?)\s?(\d+)/);
        if (moneyMatch) {
            amount = parseInt(moneyMatch[2]);
        }

        // Infer Skill & Title
        if (text.includes('web') || text.includes('site') || text.includes('react') || text.includes('app')) {
            skill = 'development';
            title = 'Web Development Task';
        } else if (text.includes('design') || text.includes('logo') || text.includes('ui')) {
            skill = 'design';
            title = 'Design Task';
        } else if (text.includes('translate') || text.includes('english')) {
            skill = 'translation';
            title = 'Translation Task';
        } else if (text.includes('writ') || text.includes('blog')) {
            skill = 'writing';
            title = 'Content Writing Task';
        } else if (text.includes('audit') || text.includes('security')) {
            skill = 'audit';
            title = 'Smart Contract Audit';
        }

        // Find Agent
        // For MVP, just pick the first available agent with the skill, or ANY agent if none
        let agents = await findAgentsBySkill(skill);
        if (agents.length === 0) {
            console.log('[AgentPoller] No agent with skill ' + skill + ', falling back to all agents');
            // Mock fallback: query raw SQL or just retry with 'general' if implemented
            const allAgentsRes = await db.query('SELECT * FROM agents WHERE is_available = true LIMIT 1');
            agents = allAgentsRes.rows as any;
        }

        let selectedAgentId = null;
        if (agents.length > 0) {
            selectedAgentId = agents[0].user_id; // Using user_id as agent_id reference in jobs
        }

        // Create Job
        console.log(`[AgentPoller] Creating job: ${title} ($${amount}) for Agent ${selectedAgentId}`);
        
        const job = await createJob(
            title,
            req.user_id,
            amount,
            req.description,
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
