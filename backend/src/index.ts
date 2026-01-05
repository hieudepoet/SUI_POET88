/**
 * =============================================================================
 * BeepLancer Backend - Main Entry Point
 * =============================================================================
 * 
 * This is the main orchestrator server that:
 * 1. Exposes REST API endpoints for the frontend
 * 2. Integrates with Beep Pay SDK for payment processing
 * 3. Connects to PostgreSQL for data persistence
 * 4. Communicates with MCP Agents for task execution
 * 5. Interacts with SUI blockchain for escrow operations
 * 
 * =============================================================================
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route modules
import jobRoutes from './routes/jobs.js';
import agentRoutes from './routes/agents.js';
import paymentRoutes from './routes/payments.js';
import userRoutes from './routes/users.js';

// Import services
import { initializeDatabase } from './db/database.js';
import { initializeBeepClient } from './services/beep.js';
import { startPaymentPolling } from './services/payment-poller.js';
import { initializeSuiClient } from './services/sui.js';

// Load environment variables
dotenv.config();

// =============================================================================
// SERVER CONFIGURATION
// =============================================================================

const app: Express = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

// CORS configuration
// TODO: Configure CORS origins based on environment
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
// TODO: Implement proper logging (consider using winston or pino)
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// =============================================================================
// API ROUTES
// =============================================================================

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API version prefix
const API_PREFIX = '/api/v1';

// Mount route handlers
// TODO: Implement each route module
app.use(`${API_PREFIX}/jobs`, jobRoutes);
app.use(`${API_PREFIX}/agents`, agentRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
// TODO: Implement proper error handling with error codes
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

/**
 * Initialize all services and start the server
 * 
 * INITIALIZATION STEPS:
 * 1. Connect to PostgreSQL database
 * 2. Initialize Beep Pay client
 * 3. Start payment polling service
 * 4. Start Express server
 */
async function startServer(): Promise<void> {
    try {
        console.log('🚀 Starting BeepLancer Backend...');

        // Step 1: Initialize database connection
        console.log('📦 Connecting to database...');
        await initializeDatabase();
        console.log('✅ Database connected');

        // Step 2: Initialize Beep Pay client
        console.log('💰 Initializing Beep Pay client...');
        await initializeBeepClient();
        console.log('✅ Beep Pay client initialized');

        // Step 3: Start payment polling service
        // This runs in the background to detect when invoices are paid
        console.log('🔄 Starting payment poller...');
        startPaymentPolling();
        console.log('✅ Payment poller started');

        // Step 4: Initialize SUI client
        console.log('💰 Initializing SUI client...');
        await initializeSuiClient();
        console.log('✅ SUI client initialized');

        // Step 5: Start the Express server
        app.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log(`🤖 BeepLancer Backend running on http://localhost:${PORT}`);
            console.log(`📡 API available at http://localhost:${PORT}${API_PREFIX}`);
            console.log('='.repeat(60));
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    // TODO: Close database connections
    // TODO: Stop payment poller
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();
