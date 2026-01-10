import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for database connection
 */
interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    max: number;           // Maximum number of clients in pool
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
}

// =============================================================================
// POOL INSTANCE
// =============================================================================

let pool: Pool | null = null;

/**
 * Get database configuration from environment variables
 * 
 * TODO: Validate that all required env vars are present
 */
function getDbConfig(): DatabaseConfig {
    // Can use DATABASE_URL or individual variables
    // TODO: Parse DATABASE_URL if provided

    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'beeplancer',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the database connection pool
 * 
 * IMPLEMENTATION:
 * 1. Create new Pool with configuration
 * 2. Test connection with a simple query
 * 3. Set up error handlers for the pool
 * 
 * @throws Error if connection fails
 */
export async function initializeDatabase(): Promise<void> {
    const config = getDbConfig();
    pool = new Pool(config);

    pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
    });

    const client = await pool.connect();
    try {
        await client.query('SELECT NOW()');
    } finally {
        client.release();
    }

    console.log('[DB] Database initialization');
}

/**
 * Get database pool instance
 */
export function getDb(): Pool {
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return pool;
}

/**
 * Execute a SQL query with parameterized values
 * 
 * @param text - SQL query string with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns QueryResult with rows and metadata
 * 
 * EXAMPLE:
 * const result = await query(
 *     'SELECT * FROM jobs WHERE status = $1 AND buyer_id = $2',
 *     ['escrowed', 123]
 * );
 * console.log(result.rows);
 */
export async function query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> {
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }

    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.log(`[DB] Slow query (${duration}ms):`, text);
    } 

    return result;
}

export async function getClient(): Promise<PoolClient> {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    return pool.connect();
}


export async function transaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function checkHealth(): Promise<boolean> {
    try {
        await query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

export async function closeDatabase(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }

    console.log('[DB] Database closed');
}
