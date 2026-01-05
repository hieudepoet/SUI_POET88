/**
 * =============================================================================
 * Agents Routes - API Endpoints for AI Agent Management
 * =============================================================================
 * 
 * Endpoints:
 * - GET    /api/v1/agents           - List all available agents
 * - GET    /api/v1/agents/:id       - Get agent details
 * - POST   /api/v1/agents           - Register as an agent
 * - PUT    /api/v1/agents/:id       - Update agent profile
 * - GET    /api/v1/agents/:id/jobs  - Get jobs for an agent
 * - POST   /api/v1/agents/:id/skills - Update agent skills
 * 
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import * as queries from '../db/queries.js';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface RegisterAgentBody {
    userId: number;
    mcpEndpoint: string;
    skills: string[];
    hourlyRate?: number;
    description?: string;
}

interface UpdateAgentBody {
    skills?: string[];
    hourlyRate?: number;
    description?: string;
    isAvailable?: boolean;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/v1/agents
 * List all available agents with optional filters
 * 
 * Query params:
 * - skill: Filter by skill (e.g., ?skill=TypeScript)
 * - minRating: Minimum rating (e.g., ?minRating=4.5)
 * - maxRate: Maximum hourly rate (e.g., ?maxRate=100)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { skill, minRating, maxRate } = req.query;

        let agents;

        if (skill) {
            // Filter by specific skill
            agents = await queries.findAgentsBySkill(skill as string);
        } else {
            // Get all available agents
            agents = await queries.getAvailableAgents();
        }

        // Apply additional filters
        let filteredAgents = agents;

        if (minRating) {
            const minRatingNum = parseFloat(minRating as string);
            filteredAgents = filteredAgents.filter(a => a.rating >= minRatingNum);
        }

        if (maxRate) {
            const maxRateNum = parseFloat(maxRate as string);
            filteredAgents = filteredAgents.filter(a => 
                a.hourly_rate !== null && a.hourly_rate <= maxRateNum
            );
        }

        res.json({
            status: 200,
            error: false,
            message: `Found ${filteredAgents.length} agents`,
            data: {
                agents: filteredAgents.map(agent => ({
                    id: agent.id,
                    userId: agent.user_id,
                    walletAddress: agent.wallet_address,
                    skills: agent.skills,
                    hourlyRate: agent.hourly_rate,
                    description: agent.description,
                    rating: agent.rating,
                    jobsCompleted: agent.jobs_completed,
                    isAvailable: agent.is_available,
                    mcpEndpoint: agent.mcp_endpoint,
                })),
                count: filteredAgents.length,
            },
        });
    } catch (error) {
        console.error('Error listing agents:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to list agents',
        });
    }
});

/**
 * GET /api/v1/agents/:id
 * Get detailed information about a specific agent
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);

        if (isNaN(agentId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid agent ID',
            });
        }

        // TODO: Implement getAgentById query
        // const agent = await queries.getAgentById(agentId);

        // if (!agent) {
        //     return res.status(404).json({
        //         status: 404,
        //         error: true,
        //         message: 'Agent not found',
        //     });
        // }

        // TODO: Get agent statistics
        // const stats = {
        //     totalEarnings: await queries.getAgentTotalEarnings(agentId),
        //     completedJobs: agent.jobs_completed,
        //     activeJobs: await queries.countActiveJobsByAgent(agentId),
        // };

        res.json({
            status: 200,
            error: false,
            message: 'Agent details retrieved (TODO: implement getAgentById)',
            data: {
                agent: {
                    id: agentId,
                    // ...agent details
                },
                // stats,
            },
        });
    } catch (error) {
        console.error('Error getting agent details:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get agent details',
        });
    }
});

/**
 * POST /api/v1/agents
 * Register a new AI agent
 * 
 * Body:
 * - userId: number (user must exist and have role 'agent')
 * - mcpEndpoint: string (MCP server URL)
 * - skills: string[] (list of skills)
 * - hourlyRate: number (optional)
 * - description: string (optional)
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, mcpEndpoint, skills, hourlyRate, description } = 
            req.body as RegisterAgentBody;

        // Validate required fields
        if (!userId || !mcpEndpoint || !skills || skills.length === 0) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'userId, mcpEndpoint, and skills are required',
            });
        }

        // Validate MCP endpoint format
        if (!mcpEndpoint.startsWith('http://') && !mcpEndpoint.startsWith('https://')) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'mcpEndpoint must be a valid HTTP(S) URL',
            });
        }

        // TODO: Verify user exists and has role 'agent'
        // const user = await queries.getUserById(userId);
        // if (!user || user.role !== 'agent') {
        //     return res.status(400).json({
        //         status: 400,
        //         error: true,
        //         message: 'User not found or not an agent',
        //     });
        // }

        // Register agent
        const agent = await queries.registerAgent(
            userId,
            mcpEndpoint,
            skills,
            hourlyRate,
            description
        );

        res.status(201).json({
            status: 201,
            error: false,
            message: 'Agent registered successfully',
            data: {
                agent: {
                    id: agent.id,
                    userId: agent.user_id,
                    mcpEndpoint: agent.mcp_endpoint,
                    skills: agent.skills,
                    hourlyRate: agent.hourly_rate,
                    description: agent.description,
                    createdAt: agent.created_at,
                },
            },
        });
    } catch (error) {
        console.error('Error registering agent:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to register agent',
        });
    }
});

/**
 * PUT /api/v1/agents/:id
 * Update agent profile
 * 
 * Body:
 * - skills: string[] (optional)
 * - hourlyRate: number (optional)
 * - description: string (optional)
 * - isAvailable: boolean (optional)
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);
        const { skills, hourlyRate, description, isAvailable } = 
            req.body as UpdateAgentBody;

        if (isNaN(agentId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid agent ID',
            });
        }

        // TODO: Implement updateAgent query
        // const updatedAgent = await queries.updateAgent(agentId, {
        //     skills,
        //     hourly_rate: hourlyRate,
        //     description,
        //     is_available: isAvailable,
        // });

        res.json({
            status: 200,
            error: false,
            message: 'Agent updated successfully (TODO: implement updateAgent)',
            data: {
                updated: {
                    agentId,
                    skills,
                    hourlyRate,
                    description,
                    isAvailable,
                },
            },
        });
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to update agent',
        });
    }
});

/**
 * GET /api/v1/agents/:id/jobs
 * Get all jobs assigned to this agent
 * 
 * Query params:
 * - status: Filter by job status (e.g., ?status=working)
 */
router.get('/:id/jobs', async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);
        const { status } = req.query;

        if (isNaN(agentId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid agent ID',
            });
        }

        // TODO: Get user_id from agent_id
        // const agent = await queries.getAgentById(agentId);
        // const userId = agent.user_id;

        // For now, use agentId as userId (TODO: fix this)
        const jobs = await queries.getJobsByAgent(
            agentId,
            status as any
        );

        res.json({
            status: 200,
            error: false,
            message: `Found ${jobs.length} jobs for agent`,
            data: {
                jobs: jobs.map(job => ({
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    createdAt: job.created_at,
                    deliveredAt: job.delivered_at,
                    escrowObjectId: job.escrow_object_id,
                })),
                count: jobs.length,
            },
        });
    } catch (error) {
        console.error('Error getting agent jobs:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get agent jobs',
        });
    }
});

/**
 * POST /api/v1/agents/:id/skills
 * Update agent skills (convenience endpoint)
 * 
 * Body:
 * - skills: string[]
 */
router.post('/:id/skills', async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);
        const { skills } = req.body;

        if (isNaN(agentId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid agent ID',
            });
        }

        if (!skills || !Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'skills must be a non-empty array',
            });
        }

        // TODO: Implement updateAgentSkills query
        // await queries.updateAgentSkills(agentId, skills);

        res.json({
            status: 200,
            error: false,
            message: 'Agent skills updated (TODO: implement updateAgentSkills)',
            data: {
                agentId,
                skills,
            },
        });
    } catch (error) {
        console.error('Error updating agent skills:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to update agent skills',
        });
    }
});

export default router;
