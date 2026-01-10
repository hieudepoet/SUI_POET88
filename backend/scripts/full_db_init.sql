-- =============================================================================
-- BeepLancer Database - MASTER INITIALIZATION SCRIPT
-- =============================================================================
-- 
-- This script:
-- 1. Resets the database (DROP ALL)
-- 2. Creates all tables and schema
-- 3. Populates test data (Agents, Users, etc.)
--
-- Usage: psql -U postgres -d BeepLancer -f full_db_init.sql
-- =============================================================================

-- =============================================================================
-- PART 1: SCHEMA INITIALIZATION
-- =============================================================================

-- Drop existing tables if they exist (in correct order)
DROP TABLE IF EXISTS user_requests CASCADE;
DROP TABLE IF EXISTS job_deliveries CASCADE;
DROP TABLE IF EXISTS pool_transactions CASCADE;
DROP TABLE IF EXISTS user_pools CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS platform_config CASCADE;

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    -- Removed UNIQUE constraint for MVP testing to allow multiple agents to share one wallet
    wallet_address VARCHAR(66) NOT NULL, 
    role VARCHAR(20) NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'agent', 'both')),
    display_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    CONSTRAINT valid_wallet_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{64}$')
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_role ON users(role);

-- AGENTS TABLE
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mcp_endpoint VARCHAR(255) NOT NULL,
    skills TEXT[] DEFAULT '{}',
    hourly_rate DECIMAL(10, 2),
    description TEXT,
    rating DECIMAL(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    jobs_completed INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_available ON agents(is_available) WHERE is_available = true;
CREATE INDEX idx_agents_skills ON agents USING GIN(skills);
CREATE INDEX idx_agents_rating ON agents(rating DESC);

-- USER POOLS TABLE
CREATE TABLE user_pools (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pool_address VARCHAR(66) UNIQUE NOT NULL,
    pool_object_id VARCHAR(66) UNIQUE NOT NULL,
    agent_address VARCHAR(66) NOT NULL,
    balance_usdc DECIMAL(20, 6) DEFAULT 0 CHECK (balance_usdc >= 0),
    total_deposited DECIMAL(20, 6) DEFAULT 0,
    total_spent DECIMAL(20, 6) DEFAULT 0,
    spending_limit DECIMAL(20, 6) DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    blockchain_created_at BIGINT
);

CREATE INDEX idx_pools_user ON user_pools(user_id);
CREATE INDEX idx_pools_active ON user_pools(is_active) WHERE is_active = true;
CREATE INDEX idx_pools_pool_id ON user_pools(pool_object_id);

-- JOBS TABLE
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    requirements TEXT,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    agent_id INTEGER REFERENCES users(id),
    amount_usdc DECIMAL(12, 6) NOT NULL CHECK (amount_usdc > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN (
        'unpaid', 'escrowed', 'working', 'delivered', 
        'completed', 'paid_out', 'cancelled', 'disputed'
    )),
    beep_invoice_id VARCHAR(255),
    reference_key VARCHAR(100) UNIQUE,
    escrow_object_id VARCHAR(66),
    escrow_tx_digest VARCHAR(66),
    release_tx_digest VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    started_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP,
    paid_out_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_buyer ON jobs(buyer_id);
CREATE INDEX idx_jobs_agent ON jobs(agent_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_reference ON jobs(reference_key);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- JOB DELIVERIES TABLE
CREATE TABLE job_deliveries (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    delivery_type VARCHAR(50) DEFAULT 'text' CHECK (delivery_type IN (
        'text', 'code', 'document', 'link', 'file'
    )),
    external_url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliveries_job ON job_deliveries(job_id);

-- POOL TRANSACTIONS TABLE
CREATE TABLE pool_transactions (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES user_pools(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdraw', 'spend', 'refund')),
    amount_usdc DECIMAL(20, 6) NOT NULL CHECK (amount_usdc > 0),
    purpose TEXT,
    job_id INTEGER REFERENCES jobs(id),
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pool_txs_pool ON pool_transactions(pool_id);

-- USER REQUESTS TABLE
CREATE TABLE user_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processed', 'failed', 'cancelled'
    )),
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_requests_user_status ON user_requests(user_id, status);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pools_updated_at BEFORE UPDATE ON user_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON user_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_job_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference_key IS NULL THEN
        NEW.reference_key = 'JOB_' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12));
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_job_reference BEFORE INSERT ON jobs
    FOR EACH ROW EXECUTE FUNCTION generate_job_reference();


-- =============================================================================
-- PART 2: POPULATE TEST DATA
-- =============================================================================

BEGIN;

-- 1. Create Regular Buyers/Users (IDs 1-9)
INSERT INTO users (id, wallet_address, role, display_name) VALUES
(1, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Alice Johnson'),
(2, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Bob Smith'),
(3, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Charlie Brown'),
(4, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'both', 'Diana Prince'),
(5, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Eve Chen'),
(6, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Frank White'),
(7, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Grace Lee'),
(8, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'both', 'Henry Wilson'),
(9, '0x2cbd7fabd5ce146e0e48ca754a4c6c88e6cdbfa4bb2ca1beaabd5ea00c97bf9c', 'buyer', 'Ivy Martinez');

-- 2. Create 10 Test Agents (Users 10-19)
-- NOTE: All using the SAME wallet address for MVP testing
INSERT INTO users (id, wallet_address, role, display_name) VALUES
(10, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'AI Code Master'),
(11, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Design Wizard'),
(12, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Content Creator'),
(13, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Data Analyst'),
(14, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Marketing Expert'),
(15, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Full Stack Dev'),
(16, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'UI/UX Specialist'),
(17, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Blockchain Dev'),
(18, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'Mobile App Dev'),
(19, '0xe8454475783032783253018e0526b68322d191741f9cc7c718e5f27495ff9ff2', 'agent', 'DevOps Engineer');

-- Reset sequence for users to ensure next INSERT gets valid ID
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 3. Create Agent Profiles (Low rates: 0.002 - 0.007 USDC)
INSERT INTO agents (user_id, mcp_endpoint, skills, hourly_rate, description, rating, jobs_completed, is_available) VALUES
(10, 'http://localhost:3000/mcp', ARRAY['coding','typescript','javascript','nodejs','react'], 0.005, 'Expert in TypeScript, React, and Node.js. Fast delivery, high quality code.', 4.9, 156, true),
(11, 'http://localhost:3000/mcp', ARRAY['design','ui','ux','figma','photoshop'], 0.003, 'Creative designer specializing in modern UI/UX. Figma expert.', 4.8, 89, true),
(12, 'http://localhost:3000/mcp', ARRAY['content','writing','copywriting','seo','marketing'], 0.002, 'Professional content writer with SEO expertise. Engaging copy that converts.', 4.7, 134, true),
(13, 'http://localhost:3000/mcp', ARRAY['data','analytics','python','sql','visualization'], 0.004, 'Data scientist skilled in Python, SQL, and data visualization. Actionable insights.', 4.9, 67, true),
(14, 'http://localhost:3000/mcp', ARRAY['marketing','social media','advertising','strategy'], 0.003, 'Digital marketing specialist. Social media expert with proven ROI.', 4.6, 112, true),
(15, 'http://localhost:3000/mcp', ARRAY['fullstack','backend','frontend','database','api'], 0.006, 'Full-stack developer. End-to-end solution architect. 10+ years experience.', 5.0, 203, true),
(16, 'http://localhost:3000/mcp', ARRAY['ui','ux','interface','user experience','usability'], 0.004, 'UI/UX specialist focused on user-centered design. Beautiful and functional.', 4.8, 91, true),
(17, 'http://localhost:3000/mcp', ARRAY['blockchain','solidity','web3','smart contracts','defi'], 0.007, 'Blockchain developer. Solidity expert. Smart contract auditing and development.', 4.9, 45, true),
(18, 'http://localhost:3000/mcp', ARRAY['mobile','ios','android','react native','flutter'], 0.005, 'Mobile app developer. iOS, Android, React Native. Cross-platform specialist.', 4.7, 78, true),
(19, 'http://localhost:3000/mcp', ARRAY['devops','ci cd','docker','kubernetes','aws'], 0.006, 'DevOps engineer. Cloud infrastructure expert. AWS, Docker, Kubernetes.', 4.8, 102, true);

-- 4. Create Additional Sample Buyer and Request (for testing)
INSERT INTO users (wallet_address, role, display_name) 
VALUES ('0x1234567890123456789012345678901234567890123456789012345678901234', 'buyer', 'Test Buyer');

-- Add a pending request for testing
INSERT INTO user_requests (user_id, description, status)
SELECT id, 'Build a simple web dashboard', 'pending'
FROM users WHERE wallet_address = '0x1234567890123456789012345678901234567890123456789012345678901234'
LIMIT 1;

COMMIT;

-- Verify
SELECT COUNT(*) as total_agents FROM agents;
SELECT COUNT(*) as total_users FROM users;

-- End


