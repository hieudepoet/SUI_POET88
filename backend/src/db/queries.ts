import { query, transaction } from './database.js';

export interface User {
    id: number;
    wallet_address: string;
    role: 'buyer' | 'agent';
    display_name: string | null;
    email: string | null;
    created_at: Date;
    last_login: Date | null;
}

export interface Agent {
    id: number;
    user_id: number;
    mcp_endpoint: string;
    skills: string[];
    hourly_rate: number | null;
    description: string | null;
    rating: number;
    jobs_completed: number;
    is_available: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Job {
    id: number;
    title: string;
    requirements: string | null;
    buyer_id: number;
    agent_id: number | null;
    amount_usdc: number;
    status: JobStatus;
    beep_invoice_id: string | null;
    reference_key: string | null;
    escrow_object_id: string | null;
    escrow_tx_digest: string | null;
    release_tx_digest: string | null;
    created_at: Date;
    paid_at: Date | null;
    started_at: Date | null;
    delivered_at: Date | null;
    completed_at: Date | null;
    paid_out_at: Date | null;
}

export type JobStatus =
    | 'unpaid'
    | 'escrowed'
    | 'working'
    | 'delivered'
    | 'completed'
    | 'paid_out'
    | 'cancelled'
    | 'disputed';

// =============================================================================
// USER QUERIES
// =============================================================================

/**
 * Find a user by their wallet address
 */
export async function findUserByWallet(walletAddress: string): Promise<User | null> {
    try {
        const result = await query<User>(
            `SELECT * FROM users WHERE wallet_address = $1`,
            [walletAddress]
        )
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error finding user by wallet address:', error);
        return null;
    }
}

/**
 * Create a new user
 */
export async function createUser(
    walletAddress: string,
    role: 'buyer' | 'agent',
    displayName?: string,
): Promise<User> {
    // const result = await query<User>(
    //     `INSERT INTO users (wallet_address, role, display_name)
    //      VALUES ($1, $2, $3)
    //      RETURNING *`,
    //     [walletAddress, role, displayName || null]
    // );
    // return result.rows[0];

    try {
        const result = await query<User>(
            `INSERT INTO users (
                wallet_address, 
                role, 
                display_name
            ) VALUE ($1, $2, $3)
            RETURNING *`,
            [walletAddress, role, displayName || null]
        )

        return result.rows[0] || null;
    } catch (err) {
        console.error('Error creating user:', err);
        throw err;
    }
}

/**
 * Get or create a user by wallet address
 * Creates a buyer account if user doesn't exist
 */
export async function getOrCreateUser(walletAddress: string): Promise<User> {
    try {
        const existing = await findUserByWallet(walletAddress);
        if (existing) return existing;
        return createUser(walletAddress, 'buyer');
    } catch (err) {
        console.error('Error getting or creating user:', err);
        throw err;
    }
}

// =============================================================================
// AGENT QUERIES
// =============================================================================

/**
 * Get all available agents
 */
export async function getAvailableAgents(): Promise<(Agent & { wallet_address: string })[]> {
    try {
        const result = await query(
            `SELECT a.*, u.wallet_address
            FROM agents a
            JOIN users u ON a.user_id = u.id
            WHERE a.is_available = true
            ORDER BY a.rating DESC, a.jobs_completed DESC`
        )

        return result.rows;
    } catch (err) {
        console.error('Error getting available agents:', err);
        throw err;
    }
}

/**
 * Get agents filtered by specific skill
 */
export async function findAgentsBySkill(skill: string): Promise<(Agent & { wallet_address: string })[]> {
    try {
        const result = await query(
            `SELECT a.*, u.wallet_address
            FROM agents a
            JOIN users u ON a.user_id = u.id
            WHERE a.is_available = true
            AND a.skills @> $1::jsonb
            ORDER BY a.rating DESC`,
            [JSON.stringify([skill])]
        );

        return result.rows;
    } catch (err) {
        console.error('Error finding agents by skill:', err);
        throw err;
    }
}

/**
 * Register a new agent
 */
export async function registerAgent(
    userId: number,
    mcpEndpoint: string,
    skills: string[],
    hourlyRate?: number,
    description?: string
): Promise<Agent> {
    try {
        const result = await query<Agent>(
            `INSERT INTO agents (
                user_id, 
                mcp_endpoint, 
                skills, 
                hourly_rate, 
                description
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [userId, mcpEndpoint, JSON.stringify(skills), hourlyRate, description]
        );

        return result.rows[0];
    } catch (err) {
        console.error('Error registering agent:', err);
        throw err;
    }
}

/**
 * Update agent's job completion stats
 */
export async function incrementAgentJobCount(agentId: number): Promise<Agent> {
    try {
        const result = await query<Agent>(
            `UPDATE agents
            SET jobs_completed = jobs_completed + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *`,
            [agentId]
        );

        return result.rows[0];
    } catch (err) {
        console.error('Error incrementing agent job count:', err);
        throw err;
    }
}

// =============================================================================
// JOB QUERIES
// =============================================================================

/**
 * Create a new job
 */
export async function createJob(
    title: string,
    buyerId: number,
    amountUsdc: number,
    requirements?: string,
    agentId?: number
): Promise<Job> {
    try {
        const referenceKey = `BL-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        const result = await query<Job>(
            `INSERT INTO jobs (
                title,
                buyer_id,
                agent_id,
                amount_usdc,
                requirements,
                reference_key
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6
            ) RETURNING *`,
            [title, buyerId, agentId || null, amountUsdc, requirements || null, referenceKey]
        );
        return result.rows[0];
    } catch (err) {
        console.log('Error creating job: ', err);
        throw err;
    }
}

/**
 * Get job by ID with full details
 */
export async function getJobById(jobId: number): Promise<Job | null> {
    try {
        const result = await query<Job>(
            `SELECT * FROM jobs WHERE id = $1`,
            [jobId]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.log('Error getting job by ID: ', err);
        throw err;
    }

}

/**
 * Get job by reference key
 * Used for payment verification
 */
export async function getJobByReferenceKey(referenceKey: string): Promise<Job | null> {
    try {
        const result = await query<Job>(
            `SELECT * FROM jobs WHERE reference_key = $1`,
            [referenceKey]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('Error getting job by reference key:', err);
        throw err;
    }
}

/**
 * Update job status
 */
export async function updateJobStatus(
    jobId: number,
    status: JobStatus,
    additionalFields?: Partial<{
        beep_invoice_id: string;
        escrow_object_id: string;
        escrow_tx_digest: string;
        release_tx_digest: string;
    }>
): Promise<Job> {
    try {
        // Build dynamic update query
        const updates: string[] = ['status = $2'];
        const params: any[] = [jobId, status];
        let paramIndex = 3;

        if (additionalFields) {
            if (additionalFields.beep_invoice_id) {
                updates.push(`beep_invoice_id = $${paramIndex}`);
                params.push(additionalFields.beep_invoice_id);
                paramIndex++;
            }
            if (additionalFields.escrow_object_id) {
                updates.push(`escrow_object_id = $${paramIndex}`);
                params.push(additionalFields.escrow_object_id);
                paramIndex++;
            }
            if (additionalFields.escrow_tx_digest) {
                updates.push(`escrow_tx_digest = $${paramIndex}`);
                params.push(additionalFields.escrow_tx_digest);
                paramIndex++;
            }
            if (additionalFields.release_tx_digest) {
                updates.push(`release_tx_digest = $${paramIndex}`);
                params.push(additionalFields.release_tx_digest);
                paramIndex++;
            }
        }

        // Update timestamps based on status
        if (status === 'escrowed') {
            updates.push('paid_at = CURRENT_TIMESTAMP');
        } else if (status === 'working') {
            updates.push('started_at = CURRENT_TIMESTAMP');
        } else if (status === 'delivered') {
            updates.push('delivered_at = CURRENT_TIMESTAMP');
        } else if (status === 'completed') {
            updates.push('completed_at = CURRENT_TIMESTAMP');
        } else if (status === 'paid_out') {
            updates.push('paid_out_at = CURRENT_TIMESTAMP');
        }

        const result = await query<Job>(
            `UPDATE jobs 
             SET ${updates.join(', ')}
             WHERE id = $1
             RETURNING *`,
            params
        );

        if (!result.rows[0]) {
            throw new Error(`Job with ID ${jobId} not found`);
        }

        return result.rows[0];
    } catch (err) {
        console.error('Error updating job status:', err);
        throw err;
    }
}

/**
 * Mark job as escrowed after payment
 */
export async function markJobAsEscrowed(
    jobId: number,
    beepInvoiceId: string,
    escrowObjectId: string,
    escrowTxDigest: string
): Promise<Job> {
    try {
        return await transaction(async (client) => {
            const result = await client.query<Job>(
                `UPDATE jobs
                 SET status = 'escrowed',
                     beep_invoice_id = $2,
                     escrow_object_id = $3,
                     escrow_tx_digest = $4,
                     paid_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [jobId, beepInvoiceId, escrowObjectId, escrowTxDigest]
            );

            if (!result.rows[0]) {
                throw new Error(`Job with ID ${jobId} not found`);
            }

            return result.rows[0];
        });
    } catch (err) {
        console.error('Error marking job as escrowed:', err);
        throw err;
    }
}

/**
 * Get all unpaid jobs with pending invoices
 * Used by payment poller
 */
export async function getUnpaidJobsWithInvoices(): Promise<Job[]> {
    try {
        const result = await query<Job>(
            `SELECT * FROM jobs
             WHERE status = 'unpaid'
             AND beep_invoice_id IS NOT NULL
             ORDER BY created_at ASC`
        );
        return result.rows;
    } catch (err) {
        console.error('Error getting unpaid jobs with invoices:', err);
        throw err;
    }
}

/**
 * Get jobs for a specific buyer
 */
export async function getJobsByBuyer(
    buyerId: number,
    status?: JobStatus
): Promise<Job[]> {
    try {
        let queryText = 'SELECT * FROM jobs WHERE buyer_id = $1';
        const params: any[] = [buyerId];

        if (status) {
            queryText += ' AND status = $2';
            params.push(status);
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await query<Job>(queryText, params);
        return result.rows;
    } catch (err) {
        console.error('Error getting jobs by buyer:', err);
        throw err;
    }
}

/**
 * Get jobs assigned to a specific agent
 */
export async function getJobsByAgent(
    agentId: number,
    status?: JobStatus
): Promise<Job[]> {
    try {
        let queryText = 'SELECT * FROM jobs WHERE agent_id = $1';
        const params: any[] = [agentId];

        if (status) {
            queryText += ' AND status = $2';
            params.push(status);
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await query<Job>(queryText, params);
        return result.rows;
    } catch (err) {
        console.error('Error getting jobs by agent:', err);
        throw err;
    }
}
