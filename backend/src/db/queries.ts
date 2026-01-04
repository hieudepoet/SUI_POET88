/**
 * =============================================================================
 * Database Queries - Type-Safe SQL Query Functions
 * =============================================================================
 * 
 * This module contains all database query functions organized by entity.
 * Each function wraps a SQL query with proper typing and error handling.
 * 
 * SECTIONS:
 * - User Queries
 * - Agent Queries
 * - Job Queries
 * - Payment Queries
 * 
 * =============================================================================
 */

import { query, transaction } from './database.js';

// =============================================================================
// TYPES
// =============================================================================

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
 * 
 * @param walletAddress - SUI wallet address
 * @returns User object or null if not found
 * 
 * TODO: Implement query
 */
export async function findUserByWallet(walletAddress: string): Promise<User | null> {
    // const result = await query<User>(
    //     'SELECT * FROM users WHERE wallet_address = $1',
    //     [walletAddress]
    // );
    // return result.rows[0] || null;

    throw new Error('findUserByWallet() not implemented');
}

/**
 * Create a new user
 * 
 * @param walletAddress - SUI wallet address
 * @param role - 'buyer' or 'agent'
 * @param displayName - Optional display name
 * @returns Created user object
 * 
 * TODO: Implement query
 */
export async function createUser(
    walletAddress: string,
    role: 'buyer' | 'agent',
    displayName?: string
): Promise<User> {
    // const result = await query<User>(
    //     `INSERT INTO users (wallet_address, role, display_name)
    //      VALUES ($1, $2, $3)
    //      RETURNING *`,
    //     [walletAddress, role, displayName || null]
    // );
    // return result.rows[0];

    throw new Error('createUser() not implemented');
}

/**
 * Get or create a user by wallet address
 * Creates a buyer account if user doesn't exist
 * 
 * @param walletAddress - SUI wallet address
 * @returns Existing or newly created user
 * 
 * TODO: Implement with upsert logic
 */
export async function getOrCreateUser(walletAddress: string): Promise<User> {
    // const existing = await findUserByWallet(walletAddress);
    // if (existing) return existing;
    // return createUser(walletAddress, 'buyer');

    throw new Error('getOrCreateUser() not implemented');
}

// =============================================================================
// AGENT QUERIES
// =============================================================================

/**
 * Get all available agents
 * 
 * @returns Array of agents that are accepting jobs
 * 
 * TODO: Implement query with JOIN to users table
 */
export async function getAvailableAgents(): Promise<(Agent & { wallet_address: string })[]> {
    // const result = await query(
    //     `SELECT a.*, u.wallet_address
    //      FROM agents a
    //      JOIN users u ON a.user_id = u.id
    //      WHERE a.is_available = true
    //      ORDER BY a.rating DESC, a.jobs_completed DESC`
    // );
    // return result.rows;

    throw new Error('getAvailableAgents() not implemented');
}

/**
 * Find an agent by their skills
 * 
 * @param skill - Skill to search for (e.g., 'code_generation')
 * @returns Array of agents with the specified skill
 * 
 * TODO: Implement JSONB query
 */
export async function findAgentsBySkill(skill: string): Promise<Agent[]> {
    // const result = await query<Agent>(
    //     `SELECT * FROM agents
    //      WHERE is_available = true
    //      AND skills @> $1::jsonb
    //      ORDER BY rating DESC`,
    //     [JSON.stringify([skill])]
    // );
    // return result.rows;

    throw new Error('findAgentsBySkill() not implemented');
}

/**
 * Register a new agent
 * 
 * @param userId - User ID (must have role='agent')
 * @param mcpEndpoint - URL of the agent's MCP server
 * @param skills - Array of skill names
 * @param hourlyRate - Rate in USDC
 * @param description - Agent description
 * @returns Created agent object
 * 
 * TODO: Implement insert query
 */
export async function registerAgent(
    userId: number,
    mcpEndpoint: string,
    skills: string[],
    hourlyRate?: number,
    description?: string
): Promise<Agent> {
    // const result = await query<Agent>(
    //     `INSERT INTO agents (user_id, mcp_endpoint, skills, hourly_rate, description)
    //      VALUES ($1, $2, $3, $4, $5)
    //      RETURNING *`,
    //     [userId, mcpEndpoint, JSON.stringify(skills), hourlyRate, description]
    // );
    // return result.rows[0];

    throw new Error('registerAgent() not implemented');
}

/**
 * Update agent's job completion stats
 * 
 * @param agentId - Agent ID
 * @returns Updated agent
 * 
 * TODO: Implement update query
 */
export async function incrementAgentJobCount(agentId: number): Promise<Agent> {
    // const result = await query<Agent>(
    //     `UPDATE agents
    //      SET jobs_completed = jobs_completed + 1,
    //          updated_at = CURRENT_TIMESTAMP
    //      WHERE id = $1
    //      RETURNING *`,
    //     [agentId]
    // );
    // return result.rows[0];

    throw new Error('incrementAgentJobCount() not implemented');
}

// =============================================================================
// JOB QUERIES
// =============================================================================

/**
 * Create a new job
 * 
 * @param title - Job title
 * @param buyerId - Buyer's user ID
 * @param amountUsdc - Payment amount in USDC
 * @param requirements - Detailed requirements
 * @param agentId - Optional: specific agent to assign
 * @returns Created job object
 * 
 * TODO: Implement with reference_key generation
 */
export async function createJob(
    title: string,
    buyerId: number,
    amountUsdc: number,
    requirements?: string,
    agentId?: number
): Promise<Job> {
    // Generate unique reference key
    // const referenceKey = `BL-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // const result = await query<Job>(
    //     `INSERT INTO jobs (title, buyer_id, agent_id, amount_usdc, requirements, reference_key)
    //      VALUES ($1, $2, $3, $4, $5, $6)
    //      RETURNING *`,
    //     [title, buyerId, agentId || null, amountUsdc, requirements || null, referenceKey]
    // );
    // return result.rows[0];

    throw new Error('createJob() not implemented');
}

/**
 * Get job by ID with full details
 * 
 * @param jobId - Job ID
 * @returns Job with buyer and agent details
 * 
 * TODO: Implement with JOINs
 */
export async function getJobById(jobId: number): Promise<Job | null> {
    // const result = await query<Job>(
    //     'SELECT * FROM jobs WHERE id = $1',
    //     [jobId]
    // );
    // return result.rows[0] || null;

    throw new Error('getJobById() not implemented');
}

/**
 * Get job by reference key
 * Used for payment verification
 * 
 * @param referenceKey - Unique reference key
 * @returns Job or null
 * 
 * TODO: Implement query
 */
export async function getJobByReferenceKey(referenceKey: string): Promise<Job | null> {
    // const result = await query<Job>(
    //     'SELECT * FROM jobs WHERE reference_key = $1',
    //     [referenceKey]
    // );
    // return result.rows[0] || null;

    throw new Error('getJobByReferenceKey() not implemented');
}

/**
 * Update job status
 * 
 * @param jobId - Job ID
 * @param status - New status
 * @param additionalFields - Optional: additional fields to update
 * @returns Updated job
 * 
 * TODO: Implement with status validation
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
    // TODO: Validate status transitions
    // const validTransitions: Record<JobStatus, JobStatus[]> = {
    //     'unpaid': ['escrowed', 'cancelled'],
    //     'escrowed': ['working', 'cancelled'],
    //     'working': ['delivered', 'cancelled'],
    //     'delivered': ['completed', 'working'],
    //     'completed': ['paid_out'],
    //     'paid_out': [],
    //     'cancelled': [],
    //     'disputed': ['cancelled', 'completed']
    // };

    // Build dynamic update query based on additionalFields
    // ...

    throw new Error('updateJobStatus() not implemented');
}

/**
 * Mark job as escrowed after payment
 * 
 * @param jobId - Job ID
 * @param beepInvoiceId - Beep Pay invoice ID
 * @param escrowObjectId - SUI escrow object ID
 * @param escrowTxDigest - Transaction digest
 * @returns Updated job
 * 
 * TODO: Implement as transaction
 */
export async function markJobAsEscrowed(
    jobId: number,
    beepInvoiceId: string,
    escrowObjectId: string,
    escrowTxDigest: string
): Promise<Job> {
    // return transaction(async (client) => {
    //     const result = await client.query<Job>(
    //         `UPDATE jobs
    //          SET status = 'escrowed',
    //              beep_invoice_id = $2,
    //              escrow_object_id = $3,
    //              escrow_tx_digest = $4,
    //              paid_at = CURRENT_TIMESTAMP
    //          WHERE id = $1
    //          RETURNING *`,
    //         [jobId, beepInvoiceId, escrowObjectId, escrowTxDigest]
    //     );
    //     return result.rows[0];
    // });

    throw new Error('markJobAsEscrowed() not implemented');
}

/**
 * Get all unpaid jobs with pending invoices
 * Used by payment poller
 * 
 * @returns Array of jobs waiting for payment
 * 
 * TODO: Implement query
 */
export async function getUnpaidJobsWithInvoices(): Promise<Job[]> {
    // const result = await query<Job>(
    //     `SELECT * FROM jobs
    //      WHERE status = 'unpaid'
    //      AND beep_invoice_id IS NOT NULL
    //      ORDER BY created_at ASC`
    // );
    // return result.rows;

    throw new Error('getUnpaidJobsWithInvoices() not implemented');
}

/**
 * Get jobs for a specific buyer
 * 
 * @param buyerId - Buyer's user ID
 * @param status - Optional: filter by status
 * @returns Array of jobs
 * 
 * TODO: Implement with pagination
 */
export async function getJobsByBuyer(
    buyerId: number,
    status?: JobStatus
): Promise<Job[]> {
    // let query = 'SELECT * FROM jobs WHERE buyer_id = $1';
    // const params: any[] = [buyerId];

    // if (status) {
    //     query += ' AND status = $2';
    //     params.push(status);
    // }

    // query += ' ORDER BY created_at DESC';

    // const result = await query<Job>(query, params);
    // return result.rows;

    throw new Error('getJobsByBuyer() not implemented');
}

/**
 * Get jobs assigned to a specific agent
 * 
 * @param agentId - Agent's user ID
 * @param status - Optional: filter by status
 * @returns Array of jobs
 * 
 * TODO: Implement with pagination
 */
export async function getJobsByAgent(
    agentId: number,
    status?: JobStatus
): Promise<Job[]> {
    // Similar to getJobsByBuyer but filters by agent_id

    throw new Error('getJobsByAgent() not implemented');
}
