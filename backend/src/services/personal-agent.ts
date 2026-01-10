import { Pool } from 'pg';
import { LlmAnalyzer, AnalyzedRequest } from './llm-analyzer.js';
import { 
    transferSuiToAgent, 
    getSharedAgentBalance, 
    getSharedAgentAddress 
} from './shared-agent.js';
import { beepSDKService } from './beep-sdk.js';

export interface UserRequest {
    id: number;
    userId: number;
    description: string;
    status: string;
}

export class PersonalAgentService {
    private db: Pool;
    private llm: LlmAnalyzer;
    
    constructor(db: Pool) {
        this.db = db;
        this.llm = new LlmAnalyzer();
    }
    
    /**
     * Process pending user requests
     */
    async processPendingRequests(): Promise<void> {
        const requests = await this.getPendingRequests();
        
        if (requests.length > 0) {
            console.log(`[Agent] Found ${requests.length} pending request(s)`);
        }
        
        for (const request of requests) {
            await this.processRequest(request);
        }
    }
    
    /**
     * Process single request with LLM analysis
     */
    private async processRequest(request: UserRequest): Promise<void> {
        try {
            console.log(`[Agent] Processing Request #${request.id}: ${request.description}`);
            
            // 1. Analyze request using LLM
            const analysis = await this.llm.analyze(request.description);
            console.log(`[Agent] Analysis: Skills=[${analysis.skills.join(', ')}], Budget=$${analysis.estimatedBudget}, Summary="${analysis.summary}"`);
            
            // 2. Find best matching agents
            const agents = await this.findAgents(analysis.skills, analysis.estimatedBudget);
            
            if (agents.length === 0) {
                // Try broader search if no exact match (increase budget constraint)
                console.log('[Agent] No exact match, trying broader search with higher budget...');
                const fallbackAgents = await this.findAgents([], analysis.estimatedBudget * 1.5);
                
                if (fallbackAgents.length === 0) {
                     console.log('[Agent] No agents found even with broader search.');
                     await this.markFailed(request.id, 'No agents found matching requirements and budget');
                     return;
                }
                // Use fallback agents
                agents.push(...fallbackAgents);
            }
            
            // 3. Select best agent (highest rating is already sorted first)
            const selectedAgent = agents[0];
            
            // 4. Create job
            const jobId = await this.createJob({
                userId: request.userId,
                agentId: selectedAgent.user_id, // Important: Use user_id (not agent table id)
                title: analysis.summary,
                budget: analysis.estimatedBudget, // Use AI estimated budget
                requirements: `Skills Required: ${analysis.skills.join(', ')}\nComplexity: ${analysis.complexity}\nOriginal Request: ${request.description}`
            });
            
            console.log(`[Agent] Created Job #${jobId} assigned to Agent User #${selectedAgent.user_id} (${selectedAgent.hourly_rate} USDC/hr)`);
            
            // 5. AUTO-PAY via Beep MCP
            console.log('[Agent] Initiating Payment via Beep MCP...');
            await this.realAutoPayAndDeliver(jobId);
            
            // 6. Mark processed
            await this.markProcessed(request.id, jobId);
            

        } catch (error) {
            console.error('[Agent] Error processing request:', error);
            await this.markFailed(request.id, error instanceof Error ? error.message : 'Unknown error');
        }
    }

    /**
     * REAL: Execute payment via Beep SDK (Invoice Creation)
     * NOTE: Since this is an autonomous agent, it creates the invoice.
     * Actual payment requires a wallet interaction.
     */
    private async realAutoPayAndDeliver(jobId: number): Promise<void> {
        const timeLog = (msg: string) => console.log(`[Agent] [Job #${jobId}] ${msg}`);

        try {
            // 1. Get Job details
            const jobRes = await this.db.query(
                `SELECT j.amount_usdc, u.wallet_address, j.title
                 FROM jobs j
                 JOIN users u ON j.agent_id = u.id
                 WHERE j.id = $1`,
                [jobId]
            );
            const job = jobRes.rows[0];

            if (!job || !job.wallet_address) {
                throw new Error('Agent wallet not found for job payment');
            }

            // 2. Create REAL Invoice via Beep SDK
            timeLog(`💸 Creating real Beep Invoice for ${job.amount_usdc} USDC...`);

            const invoice = await beepSDKService.createInvoice({
                amount: job.amount_usdc,
                description: `Agent Auto-Job #${jobId}: ${job.title}`
            });

            timeLog(`✅ Invoice Created! ID: ${invoice.invoiceId}`);
            timeLog(`🔗 Payment URL: ${invoice.paymentUrl}`);

            // 3. Update DB with Invoice ID
            await this.db.query(
                `UPDATE jobs 
                 SET beep_invoice_id = $1, status = 'unpaid', updated_at = NOW() 
                 WHERE id = $2`, 
                [invoice.invoiceId, jobId]
            );
            
            timeLog(`📝 Job updated with Invoice ID. Waiting for payment...`);
            
            // Note: We stop here. The PaymentPoller will detect payment and proceed.

        } catch (error) {
            console.error(`[Pay Error] Job #${jobId}:`, error);
            throw error;
        }
    }

    /**
     * MOCK: Fallback execution
     */
    private async mockAutoPayAndDeliver(jobId: number): Promise<void> {
        console.log(`[Agent] [Job #${jobId}] Executing fallback mock payment...`);
        await this.db.query(`UPDATE jobs SET status = 'escrowed', updated_at = NOW() WHERE id = $1`, [jobId]);
        await this.db.query(`UPDATE jobs SET status = 'working', started_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
        await this.db.query(`INSERT INTO job_deliveries (job_id, content, delivery_type) VALUES ($1, 'Mock Delivery Content', 'link')`, [jobId]);
        await this.db.query(`UPDATE jobs SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
        await this.db.query(`UPDATE jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
    }

    /**
     * Get pending requests from DB
     */
    private async getPendingRequests(): Promise<UserRequest[]> {
        const result = await this.db.query<UserRequest>(
            `SELECT id, user_id as "userId", description, status 
             FROM user_requests 
             WHERE status = 'pending' 
             ORDER BY created_at ASC 
             LIMIT 5`
        );
        return result.rows;
    }

    /**
     * Find agents matching skills and budget
     */
    private async findAgents(skills: string[], maxBudget: number): Promise<any[]> {
        const hasSkills = skills.length > 0;
        
        let query = `
            SELECT a.id, a.user_id, a.skills, a.hourly_rate, a.rating
            FROM agents a
            WHERE a.is_available = true 
            AND a.hourly_rate <= $1
        `;
        
        const params: any[] = [maxBudget];
        
        if (hasSkills) {
            query += ` AND a.skills::text[] && $2::text[]`;
            params.push(skills);
        }
        
        query += ` ORDER BY a.rating DESC, a.hourly_rate ASC LIMIT 5`;
        
        const result = await this.db.query(query, params);
        return result.rows;
    }

    /**
     * Create a new job in DB
     */
    private async createJob(params: {
        userId: number;
        agentId: number;
        title: string;
        budget: number;
        requirements: string;
    }): Promise<number> {
        const result = await this.db.query(
            `INSERT INTO jobs (
                buyer_id, agent_id, title, amount_usdc, 
                requirements, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, 'unpaid', NOW(), NOW())
            RETURNING id`,
            [params.userId, params.agentId, params.title, params.budget, params.requirements]
        );
        return result.rows[0].id;
    }

    /**
     * Mark request as processed
     */
    private async markProcessed(requestId: number, jobId: number): Promise<void> {
        await this.db.query(
            `UPDATE user_requests 
             SET status = 'processed', job_id = $1, updated_at = NOW() 
             WHERE id = $2`,
            [jobId, requestId]
        );
    }

    /**
     * Mark request as failed
     */
    private async markFailed(requestId: number, error: string): Promise<void> {
        await this.db.query(
            `UPDATE user_requests 
             SET status = 'failed', error_message = $1, updated_at = NOW() 
             WHERE id = $2`,
            [error, requestId]
        );
    }
}

/**
 * Background worker - runs every 30s
 */
export async function startPersonalAgentWorker(db: Pool): Promise<void> {
    const agent = new PersonalAgentService(db);
    
    console.log('[Agent] Worker started');
    
    // Initial check
    agent.processPendingRequests().catch(e => console.error(e));
    
    setInterval(async () => {
        try {
            await agent.processPendingRequests();
        } catch (error) {
            console.error('[Agent] Worker error:', error);
        }
    }, 30000); // Every 30 seconds
}
