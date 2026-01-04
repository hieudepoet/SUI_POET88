/**
 * =============================================================================
 * Agents Routes - API Endpoints for Agent Management
 * =============================================================================
 * 
 * Endpoints:
 * - GET    /api/v1/agents          - List available agents
 * - GET    /api/v1/agents/:id      - Get agent details
 * - POST   /api/v1/agents/register - Register as an agent
 * - PUT    /api/v1/agents/:id      - Update agent profile
 * - GET    /api/v1/agents/:id/jobs - Get agent's jobs
 * - POST   /api/v1/agents/:id/availability - Toggle availability
 * 
 * =============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface RegisterAgentBody {
    mcpEndpoint: string;
    skills: string[];
    hourlyRate?: number;
    description?: string;
}

interface UpdateAgentBody {
    mcpEndpoint?: string;
    skills?: string[];
    hourlyRate?: number;
    description?: string;
    isAvailable?: boolean;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Authentication middleware for agent routes
 * 
 * TODO: Implement proper wallet authentication
 */
async function authenticateWallet(req: Request, res: Response, next: NextFunction) {
    // const walletAddress = req.headers['x-wallet-address'] as string;
    // if (!walletAddress) {
    //     return res.status(401).json({ error: 'Authentication required' });
    // }
    // req.user = { walletAddress };
    next();
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/v1/agents
 * List all available agents
 * 
 * Query params:
 * - skill: Filter by skill
 * - available: Filter by availability (true/false)
 * - minRating: Minimum rating filter
 * - page, limit: Pagination
 * 
 * Returns:
 * - Array of agents with their skills and ratings
 * 
 * TODO: Implement agent listing
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { skill, available, minRating, page, limit } = req.query;

        // Build filter criteria
        // const filters = {
        //     skill: skill as string,
        //     available: available === 'true',
        //     minRating: minRating ? parseFloat(minRating as string) : undefined
        // };

        // Get available agents
        // const agents = await getAvailableAgents(filters);

        // return res.json({
        //     agents,
        //     pagination: { page: 1, limit: 20, total: agents.length }
        // });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error listing agents:', error);
        res.status(500).json({ error: 'Failed to list agents' });
    }
});

/**
 * GET /api/v1/agents/:id
 * Get detailed agent information
 * 
 * Returns:
 * - Agent profile
 * - Skills list
 * - Rating and job history stats
 * 
 * TODO: Implement agent detail retrieval
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);

        // if (isNaN(agentId)) {
        //     return res.status(400).json({ error: 'Invalid agent ID' });
        // }

        // const agent = await getAgentById(agentId);

        // if (!agent) {
        //     return res.status(404).json({ error: 'Agent not found' });
        // }

        // return res.json({ agent });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error getting agent:', error);
        res.status(500).json({ error: 'Failed to get agent' });
    }
});

/**
 * POST /api/v1/agents/register
 * Register as a new agent
 * 
 * Body:
 * - mcpEndpoint: string (required) - URL of agent's MCP server
 * - skills: string[] (required) - List of skills offered
 * - hourlyRate: number - Rate in USDC per hour
 * - description: string - Agent description
 * 
 * Returns:
 * - Created agent profile
 * 
 * WORKFLOW:
 * 1. Create/update user with role='agent'
 * 2. Create agent profile with MCP endpoint
 * 3. Verify MCP endpoint is reachable
 * 
 * TODO: Implement agent registration
 */
router.post('/register', authenticateWallet, async (req: Request, res: Response) => {
    try {
        const body = req.body as RegisterAgentBody;

        // Validate required fields
        // if (!body.mcpEndpoint || !body.skills || body.skills.length === 0) {
        //     return res.status(400).json({ 
        //         error: 'mcpEndpoint and at least one skill are required' 
        //     });
        // }

        // Validate MCP endpoint format
        // try {
        //     new URL(body.mcpEndpoint);
        // } catch {
        //     return res.status(400).json({ error: 'Invalid MCP endpoint URL' });
        // }

        // Get caller's wallet
        // const walletAddress = req.user.walletAddress;

        // Create or get user with agent role
        // let user = await findUserByWallet(walletAddress);
        // if (!user) {
        //     user = await createUser(walletAddress, 'agent');
        // } else if (user.role !== 'agent') {
        //     // Update user role to agent
        //     user = await updateUserRole(user.id, 'agent');
        // }

        // Check if already registered as agent
        // const existingAgent = await getAgentByUserId(user.id);
        // if (existingAgent) {
        //     return res.status(400).json({ error: 'Already registered as agent' });
        // }

        // Optional: Verify MCP endpoint is reachable
        // const isReachable = await verifyMcpEndpoint(body.mcpEndpoint);
        // if (!isReachable) {
        //     return res.status(400).json({ error: 'MCP endpoint is not reachable' });
        // }

        // Register the agent
        // const agent = await registerAgent(
        //     user.id,
        //     body.mcpEndpoint,
        //     body.skills,
        //     body.hourlyRate,
        //     body.description
        // );

        // return res.status(201).json({ agent });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error registering agent:', error);
        res.status(500).json({ error: 'Failed to register agent' });
    }
});

/**
 * PUT /api/v1/agents/:id
 * Update agent profile
 * 
 * Body (all optional):
 * - mcpEndpoint: string
 * - skills: string[]
 * - hourlyRate: number
 * - description: string
 * - isAvailable: boolean
 * 
 * TODO: Implement agent update
 */
router.put('/:id', authenticateWallet, async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);
        const body = req.body as UpdateAgentBody;

        // Verify caller owns this agent
        // const agent = await getAgentById(agentId);
        // if (!agent) {
        //     return res.status(404).json({ error: 'Agent not found' });
        // }

        // const agentUser = await getUserById(agent.user_id);
        // if (agentUser.wallet_address !== req.user.walletAddress) {
        //     return res.status(403).json({ error: 'Not authorized' });
        // }

        // Update agent
        // const updatedAgent = await updateAgent(agentId, body);

        // return res.json({ agent: updatedAgent });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({ error: 'Failed to update agent' });
    }
});

/**
 * GET /api/v1/agents/:id/jobs
 * Get jobs for a specific agent
 * 
 * Query params:
 * - status: Filter by status
 * - page, limit: Pagination
 * 
 * TODO: Implement agent jobs listing
 */
router.get('/:id/jobs', async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);
        const { status, page, limit } = req.query;

        // Get agent's user_id
        // const agent = await getAgentById(agentId);
        // if (!agent) {
        //     return res.status(404).json({ error: 'Agent not found' });
        // }

        // Get jobs
        // const jobs = await getJobsByAgent(agent.user_id, status as string);

        // return res.json({ jobs });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error getting agent jobs:', error);
        res.status(500).json({ error: 'Failed to get agent jobs' });
    }
});

/**
 * POST /api/v1/agents/:id/availability
 * Toggle agent availability
 * 
 * Body:
 * - available: boolean
 * 
 * TODO: Implement availability toggle
 */
router.post('/:id/availability', authenticateWallet, async (req: Request, res: Response) => {
    try {
        const agentId = parseInt(req.params.id);
        const { available } = req.body;

        // Verify ownership and update
        // ...

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ error: 'Failed to update availability' });
    }
});

/**
 * GET /api/v1/agents/skills
 * Get all available skills in the marketplace
 * 
 * Returns:
 * - List of unique skills with agent counts
 * 
 * TODO: Implement skills aggregation
 */
router.get('/skills', async (req: Request, res: Response) => {
    try {
        // Aggregate skills from all agents
        // const skills = await getAggregatedSkills();

        // return res.json({ skills });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error getting skills:', error);
        res.status(500).json({ error: 'Failed to get skills' });
    }
});

export default router;
