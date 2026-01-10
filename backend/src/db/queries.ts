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

export interface UserPool {
    id: number;
    user_id: number;
    pool_address: string;
    pool_object_id: string;
    agent_address: string;
    balance_usdc: number;
    total_deposited: number;
    total_spent: number;
    spending_limit: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    blockchain_created_at: number | null;
}

export interface PoolTransaction {
    id: number;
    pool_id: number;
    type: 'deposit' | 'spend' | 'withdraw' | 'refund';
    amount_usdc: number;
    job_id: number | null;
    tx_digest: string | null;
    purpose: string | null;
    created_at: Date;
}

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
            ) VALUES ($1, $2, $3)
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
 * Agent wallet is automatically available via getAgentAddress(userId)
 */
export async function getOrCreateUser(walletAddress: string): Promise<User> {
    try {
        const existing = await findUserByWallet(walletAddress);
        if (existing) {
            return existing;
        }
        
        // Create new user - agent wallet auto-generated from ID
        const user = await createUser(walletAddress, 'buyer');
        return user;
    } catch (err) {
        console.error('Error getting or creating user:', err);
        throw err;
    }
}

export async function getUserById(id: number): Promise<User | null> {
    try {
        const result = await query<User>(
            `SELECT * FROM users WHERE id = $1`,
            [id]
        )
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error finding user by id:', error);
        return null;
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
        // referenceKey will be set when invoice is created via Beep SDK
        const result = await query<Job>(
            `INSERT INTO jobs (
                title,
                buyer_id,
                agent_id,
                amount_usdc,
                requirements
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5
            ) RETURNING *`,
            [title, buyerId, agentId || null, amountUsdc, requirements || null]
        );
        return result.rows[0];
    } catch (err) {
        console.log('Error creating job: ', err);
        throw err;
    }
}

export async function updateJobReferenceKeyById(jobId: number, referenceKey?: string): Promise<Job> {
    try {
        const result = await query<Job>(
            `UPDATE jobs
            SET reference_key = $2
            WHERE id = $1
            RETURNING *`,
            [jobId, referenceKey]
        );
        return result.rows[0];
    } catch (err) {
        console.log('Error updating job reference key: ', err);
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
        reference_key: string;
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
            if (additionalFields.reference_key) {
                updates.push(`reference_key = $${paramIndex}`);
                params.push(additionalFields.reference_key);
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

// =============================================================================
// USER POOL QUERIES
// =============================================================================

/**
 * Create a new user pool record
 */
export async function createUserPool(
    userId: number,
    poolAddress: string,
    poolObjectId: string,
    agentAddress: string,
    spendingLimit: number,
    blockchainCreatedAt?: number
): Promise<UserPool> {
    try {
        const result = await query<UserPool>(
            `INSERT INTO user_pools 
            (user_id, pool_address, pool_object_id, agent_address, spending_limit, blockchain_created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [userId, poolAddress, poolObjectId, agentAddress, spendingLimit, blockchainCreatedAt || null]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error creating user pool:', err);
        throw err;
    }
}

/**
 * Get pool by user ID
 */
export async function getPoolByUser(userId: number): Promise<UserPool | null> {
    try {
        const result = await query<UserPool>(
            `SELECT * FROM user_pools WHERE user_id = $1 AND is_active = true`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('Error getting pool by user:', err);
        throw err;
    }
}

/**
 * Get pool by object ID
 */
export async function getPoolByObjectId(poolObjectId: string): Promise<UserPool | null> {
    try {
        const result = await query<UserPool>(
            `SELECT * FROM user_pools WHERE pool_object_id = $1`,
            [poolObjectId]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('Error getting pool by object ID:', err);
        throw err;
    }
}

/**
 * Update pool balance (sync from blockchain)
 */
export async function updatePoolBalance(
    poolId: number,
    balanceUsdc: number,
    totalDeposited?: number,
    totalSpent?: number
): Promise<UserPool> {
    try {
        let queryText = `UPDATE user_pools SET balance_usdc = $1, updated_at = NOW()`;
        const params: any[] = [balanceUsdc];
        let paramCount = 2;

        if (totalDeposited !== undefined) {
            queryText += `, total_deposited = $${paramCount}`;
            params.push(totalDeposited);
            paramCount++;
        }

        if (totalSpent !== undefined) {
            queryText += `, total_spent = $${paramCount}`;
            params.push(totalSpent);
            paramCount++;
        }

        queryText += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(poolId);

        const result = await query<UserPool>(queryText, params);
        return result.rows[0];
    } catch (err) {
        console.error('Error updating pool balance:', err);
        throw err;
    }
}

/**
 * Record a pool transaction
 */
export async function createPoolTransaction(
    poolId: number,
    type: 'deposit' | 'spend' | 'withdraw' | 'refund',
    amount: number,
    txDigest?: string,
    jobId?: number,
    purpose?: string
): Promise<PoolTransaction> {
    try {
        const result = await query<PoolTransaction>(
            `INSERT INTO pool_transactions 
            (pool_id, type, amount_usdc, tx_digest, job_id, purpose)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [poolId, type, amount, txDigest || null, jobId || null, purpose || null]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error creating pool transaction:', err);
        throw err;
    }
}

/**
 * Get pool transaction history
 */
export async function getPoolTransactions(
    poolId: number,
    limit: number = 50
): Promise<PoolTransaction[]> {
    try {
        const result = await query<PoolTransaction>(
            `SELECT * FROM pool_transactions 
            WHERE pool_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2`,
            [poolId, limit]
        );
        return result.rows;
    } catch (err) {
        console.error('Error getting pool transactions:', err);
        throw err;
    }
}

/**
 * Deactivate a pool
 */
export async function deactivatePool(poolId: number): Promise<UserPool> {
    try {
        const result = await query<UserPool>(
            `UPDATE user_pools SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [poolId]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error deactivating pool:', err);
        throw err;
    }
}

// =============================================================================
// JOB DELIVERIES QUERIES
// =============================================================================

/**
 * Create a job delivery
 */
export async function createDelivery(
    jobId: number,
    content: string,
    deliveryType: string = 'text',
    externalUrl?: string,
    notes?: string
): Promise<number> {
    try {
        const result = await query<{ id: number }>(
            `INSERT INTO job_deliveries (job_id, content, delivery_type, external_url, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [jobId, content, deliveryType, externalUrl || null, notes || null]
        );
        return result.rows[0].id;
    } catch (err) {
        console.error('Error creating delivery:', err);
        throw err;
    }
}

/**
 * Get deliveries for a job
 */
export async function getDeliveriesByJob(jobId: number): Promise<any[]> {
    try {
        const result = await query(
            `SELECT * FROM job_deliveries WHERE job_id = $1 ORDER BY created_at DESC`,
            [jobId]
        );
        return result.rows;
    } catch (err) {
        console.error('Error getting deliveries:', err);
        throw err;
    }
}

// =============================================================================
// USER UPDATE QUERIES
// =============================================================================

/**
 * Update user profile
 */
export async function updateUser(
    userId: number,
    displayName?: string,
    email?: string
): Promise<User> {
    try {
        let queryText = 'UPDATE users SET';
        const params: any[] = [];
        const updates: string[] = [];
        let paramCount = 1;

        if (displayName !== undefined) {
            updates.push(` display_name = $${paramCount}`);
            params.push(displayName);
            paramCount++;
        }

        if (email !== undefined) {
            updates.push(` email = $${paramCount}`);
            params.push(email);
            paramCount++;
        }

        if (updates.length === 0) {
            throw new Error('No updates provided');
        }

        queryText += updates.join(',');
        queryText += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(userId);

        const result = await query<User>(queryText, params);
        return result.rows[0];
    } catch (err) {
        console.error('Error updating user:', err);
        throw err;
    }
}

// =============================================================================
// AGENT UPDATE QUERIES
// =============================================================================

/**
 * Update agent profile
 */
export async function updateAgent(
    agentId: number,
    updates: {
        mcpEndpoint?: string;
        hourlyRate?: number;
        description?: string;
        isAvailable?: boolean;
    }
): Promise<Agent> {
    try {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (updates.mcpEndpoint !== undefined) {
            fields.push(`mcp_endpoint = $${paramCount}`);
            values.push(updates.mcpEndpoint);
            paramCount++;
        }

        if (updates.hourlyRate !== undefined) {
            fields.push(`hourly_rate = $${paramCount}`);
            values.push(updates.hourlyRate);
            paramCount++;
        }

        if (updates.description !== undefined) {
            fields.push(`description = $${paramCount}`);
            values.push(updates.description);
            paramCount++;
        }

        if (updates.isAvailable !== undefined) {
            fields.push(`is_available = $${paramCount}`);
            values.push(updates.isAvailable);
            paramCount++;
        }

        if (fields.length === 0) {
            throw new Error('No updates provided');
        }

        fields.push(`updated_at = NOW()`);

        const result = await query<Agent>(
            `UPDATE agents SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            [...values, agentId]
        );

        if (!result.rows[0]) {
            throw new Error('Agent not found');
        }

        return result.rows[0];
    } catch (err) {
        console.error('Error updating agent:', err);
        throw err;
    }
}

/**
 * Update agent skills
 */
export async function updateAgentSkills(
    agentId: number,
    skills: string[]
): Promise<Agent> {
    try {
        const result = await query<Agent>(
            `UPDATE agents SET skills = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [skills, agentId]
        );
        
        if (!result.rows[0]) {
            throw new Error('Agent not found');
        }
        
        return result.rows[0];
    } catch (err) {
        console.error('Error updating agent skills:', err);
        throw err;
    }
}

/**
 * Get all jobs with optional filters
 */
export async function getAllJobs(
    status?: string,
    limit: number = 50,
    offset: number = 0
): Promise<Job[]> {
    try {
        let queryText = 'SELECT * FROM jobs';
        const params: any[] = [];
        
        if (status) {
            queryText += ' WHERE status = $1';
            params.push(status);
        }
        
        queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await query<Job>(queryText, params);
        return result.rows;
    } catch (err) {
        console.error('Error getting all jobs:', err);
        throw err;
    }
}
