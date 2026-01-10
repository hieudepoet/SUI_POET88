/**
 * Chat Routes - User requests to Personal Agent
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

/**
 * POST /api/v1/chat/request
 * Create a new user request for Personal Agent to process
 */
router.post('/request', async (req: Request, res: Response) => {
    try {
        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'userId and message are required',
            });
        }

        const db = getDb();
        
        // Create user request
        const result = await db.query(
            `INSERT INTO user_requests (user_id, description, status)
             VALUES ($1, $2, 'pending') RETURNING *`,
            [userId, message]
        );

        const request = result.rows[0];

        res.json({
            status: 200,
            error: false,
            message: 'Request created successfully. Personal Agent will process it shortly.',
            data: {
                requestId: request.id,
                status: request.status,
                createdAt: request.created_at,
                estimatedProcessingTime: '30 seconds',
            },
        });
    } catch (error) {
        console.error('Error creating chat request:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to create request',
        });
    }
});

/**
 * GET /api/v1/chat/requests/:userId
 * Get all user requests with status
 */
router.get('/requests/:userId', async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid user ID',
            });
        }

        const db = getDb();
        
        const result = await db.query(
            `SELECT ur.*, j.title as job_title, j.status as job_status, j.amount_usdc
             FROM user_requests ur
             LEFT JOIN jobs j ON ur.job_id = j.id
             WHERE ur.user_id = $1
             ORDER BY ur.created_at DESC
             LIMIT 50`,
            [userId]
        );

        res.json({
            status: 200,
            error: false,
            data: {
                requests: result.rows,
                count: result.rows.length,
            },
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to fetch requests',
        });
    }
});

/**
 * GET /api/v1/chat/request/:requestId
 * Get single request status with updates
 */
router.get('/request/:requestId', async (req: Request, res: Response) => {
    try {
        const requestId = parseInt(req.params.requestId);

        if (isNaN(requestId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid request ID',
            });
        }

        const db = getDb();
        
        const result = await db.query(
            `SELECT ur.*, j.*, 
                    a.skills as agent_skills, 
                    a.hourly_rate as agent_rate,
                    u.wallet_address as agent_wallet
             FROM user_requests ur
             LEFT JOIN jobs j ON ur.job_id = j.id
             LEFT JOIN agents a ON j.agent_id = a.user_id
             LEFT JOIN users u ON a.user_id = u.id
             WHERE ur.id = $1`,
            [requestId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Request not found',
            });
        }

        const request = result.rows[0];

        res.json({
            status: 200,
            error: false,
            data: {
                request: {
                    id: request.id,
                    description: request.description,
                    status: request.status,
                    createdAt: request.created_at,
                    updatedAt: request.updated_at,
                    errorMessage: request.error_message,
                },
                job: request.job_id ? {
                    id: request.job_id,
                    title: request.title,
                    status: request.status,
                    amount: request.amount_usdc,
                    agentSkills: request.agent_skills,
                    agentRate: request.agent_rate,
                    agentWallet: request.agent_wallet,
                } : null,
            },
        });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to fetch request',
        });
    }
});

export default router;
