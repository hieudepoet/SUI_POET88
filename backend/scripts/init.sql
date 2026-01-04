-- =============================================================================
-- BeepLancer Database Initialization Script
-- =============================================================================
-- Run this script to set up the PostgreSQL database:
-- psql -h localhost -U postgres -d beeplancer -f init.sql
-- =============================================================================

-- Drop existing tables if they exist (for development reset)
DROP TABLE IF EXISTS job_deliveries CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS platform_config CASCADE;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Stores all users (both buyers and agents)
-- A user is identified by their SUI wallet address
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    -- Role: 'buyer' can hire agents, 'agent' can perform work
    role TEXT CHECK (role IN ('buyer', 'agent')) NOT NULL,
    -- Display name for the user
    display_name TEXT,
    -- Email for notifications (optional)
    email TEXT,
    -- User created timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Last login timestamp
    last_login TIMESTAMP
);

-- =============================================================================
-- AGENTS TABLE
-- =============================================================================
-- Extended information for AI agent accounts
-- Links to users table where role = 'agent'
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    -- Agent's MCP server endpoint URL
    mcp_endpoint TEXT NOT NULL,
    -- List of skills/tools the agent offers (JSON array)
    -- Example: ["code_generation", "code_audit", "translation"]
    skills JSONB DEFAULT '[]',
    -- Hourly rate in USDC
    hourly_rate DECIMAL(12, 6),
    -- Description of the agent's capabilities
    description TEXT,
    -- Rating (1-5 scale, calculated from reviews)
    rating DECIMAL(3, 2) DEFAULT 0,
    -- Total jobs completed
    jobs_completed INTEGER DEFAULT 0,
    -- Whether the agent is currently accepting jobs
    is_available BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- JOBS TABLE
-- =============================================================================
-- Core table tracking all freelance jobs
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    -- Job title/description
    title TEXT NOT NULL,
    -- Detailed requirements (can be long text or JSON)
    requirements TEXT,
    -- The buyer who created this job
    buyer_id INTEGER REFERENCES users(id),
    -- The agent assigned to this job
    agent_id INTEGER REFERENCES users(id),
    -- Payment amount in USDC
    amount_usdc DECIMAL(12, 6) NOT NULL,
    
    -- ==========================================================================
    -- JOB STATUS FLOW:
    -- ==========================================================================
    -- 'unpaid'    -> Job created, waiting for buyer payment
    -- 'escrowed'  -> Payment received, funds locked on-chain
    -- 'working'   -> Agent is actively working on the job
    -- 'delivered' -> Agent has submitted deliverables
    -- 'completed' -> Buyer approved, waiting for payout
    -- 'paid_out'  -> Funds released to agent, job closed
    -- 'cancelled' -> Job cancelled, funds refunded to buyer
    -- 'disputed'  -> Job in dispute resolution
    -- ==========================================================================
    status TEXT DEFAULT 'unpaid' CHECK (
        status IN ('unpaid', 'escrowed', 'working', 'delivered', 
                   'completed', 'paid_out', 'cancelled', 'disputed')
    ),
    
    -- Beep Pay invoice tracking
    beep_invoice_id TEXT,
    -- Unique reference key for payment verification
    reference_key TEXT UNIQUE,
    
    -- SUI blockchain tracking
    -- Object ID of the LockedPayment on-chain
    escrow_object_id TEXT,
    -- Transaction digest for escrow creation
    escrow_tx_digest TEXT,
    -- Transaction digest for escrow release
    release_tx_digest TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    started_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP,
    paid_out_at TIMESTAMP
);

-- =============================================================================
-- JOB DELIVERIES TABLE
-- =============================================================================
-- Stores the actual work output from agents
CREATE TABLE job_deliveries (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    -- The content/result of the agent's work
    -- Could be code, text, or reference to external storage
    content TEXT,
    -- Type of delivery: 'code', 'document', 'link', etc.
    delivery_type TEXT DEFAULT 'text',
    -- If content is too large, store reference to external storage
    external_url TEXT,
    -- Agent's notes about the delivery
    notes TEXT,
    -- Version number for multiple submissions
    version INTEGER DEFAULT 1,
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PLATFORM CONFIG TABLE
-- =============================================================================
-- Stores platform-wide configuration values
CREATE TABLE platform_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INSERT DEFAULT CONFIG VALUES
-- =============================================================================
INSERT INTO platform_config (key, value, description) VALUES
    ('platform_fee_percent', '5', 'Platform fee percentage taken from each job'),
    ('min_job_amount_usdc', '1', 'Minimum job amount in USDC'),
    ('max_job_amount_usdc', '10000', 'Maximum job amount in USDC'),
    ('escrow_timeout_hours', '168', 'Hours before automatic escrow release (7 days)');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_buyer ON jobs(buyer_id);
CREATE INDEX idx_jobs_agent ON jobs(agent_id);
CREATE INDEX idx_jobs_reference ON jobs(reference_key);
CREATE INDEX idx_agents_available ON agents(is_available);

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View: Active jobs with user details
CREATE VIEW v_active_jobs AS
SELECT 
    j.id,
    j.title,
    j.amount_usdc,
    j.status,
    j.created_at,
    b.wallet_address as buyer_wallet,
    b.display_name as buyer_name,
    a.wallet_address as agent_wallet,
    ag.skills as agent_skills
FROM jobs j
LEFT JOIN users b ON j.buyer_id = b.id
LEFT JOIN users a ON j.agent_id = a.id
LEFT JOIN agents ag ON a.id = ag.user_id
WHERE j.status NOT IN ('paid_out', 'cancelled');

-- View: Agent performance stats
CREATE VIEW v_agent_stats AS
SELECT 
    u.id as user_id,
    u.wallet_address,
    u.display_name,
    a.skills,
    a.hourly_rate,
    a.rating,
    a.jobs_completed,
    a.is_available,
    COALESCE(SUM(CASE WHEN j.status = 'paid_out' THEN j.amount_usdc END), 0) as total_earned
FROM users u
JOIN agents a ON u.id = a.user_id
LEFT JOIN jobs j ON u.id = j.agent_id
GROUP BY u.id, u.wallet_address, u.display_name, 
         a.skills, a.hourly_rate, a.rating, a.jobs_completed, a.is_available;

-- =============================================================================
-- STORED PROCEDURES / FUNCTIONS (Optional - implement as needed)
-- =============================================================================

-- Function: Generate unique reference key for jobs
-- TODO: Implement this function
-- CREATE OR REPLACE FUNCTION generate_reference_key() RETURNS TEXT AS $$
-- BEGIN
--     RETURN 'BL-' || to_char(now(), 'YYYYMMDD') || '-' || 
--            upper(substring(md5(random()::text) from 1 for 8));
-- END;
-- $$ LANGUAGE plpgsql;

-- Function: Update job status with validation
-- TODO: Implement status transition validation
-- CREATE OR REPLACE FUNCTION update_job_status(
--     p_job_id INTEGER,
--     p_new_status TEXT
-- ) RETURNS BOOLEAN AS $$
-- BEGIN
--     -- Validate status transitions
--     -- unpaid -> escrowed (only valid transition from unpaid)
--     -- escrowed -> working | cancelled
--     -- working -> delivered | cancelled
--     -- delivered -> completed | working (revision)
--     -- completed -> paid_out
--     -- TODO: Implement transition logic
--     RETURN TRUE;
-- END;
-- $$ LANGUAGE plpgsql;

-- =============================================================================
-- END OF INITIALIZATION SCRIPT
-- =============================================================================
