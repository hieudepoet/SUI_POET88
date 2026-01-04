/**
 * =============================================================================
 * Users Routes - API Endpoints for User Management
 * =============================================================================
 * 
 * Endpoints:
 * - GET    /api/v1/users/me       - Get current user profile
 * - POST   /api/v1/users/auth     - Authenticate/register with wallet
 * - PUT    /api/v1/users/me       - Update user profile
 * - GET    /api/v1/users/:address - Get user by wallet address
 * 
 * =============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface AuthBody {
    walletAddress: string;
    signature: string;
    message: string;
}

interface UpdateProfileBody {
    displayName?: string;
    email?: string;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Authentication middleware
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
 * GET /api/v1/users/me
 * Get current authenticated user's profile
 * 
 * Returns:
 * - User profile
 * - Agent info (if registered as agent)
 * - Statistics (jobs posted/completed, earnings, etc.)
 * 
 * TODO: Implement user profile retrieval
 */
router.get('/me', authenticateWallet, async (req: Request, res: Response) => {
    try {
        // Get user by wallet address
        // const walletAddress = req.user.walletAddress;
        // const user = await findUserByWallet(walletAddress);

        // if (!user) {
        //     return res.status(404).json({ error: 'User not found' });
        // }

        // Get additional info if agent
        // let agentInfo = null;
        // if (user.role === 'agent') {
        //     agentInfo = await getAgentByUserId(user.id);
        // }

        // Get stats
        // const stats = await getUserStats(user.id);

        // return res.json({
        //     user,
        //     agentInfo,
        //     stats
        // });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

/**
 * POST /api/v1/users/auth
 * Authenticate with wallet signature
 * 
 * Body:
 * - walletAddress: string
 * - signature: string (signed message)
 * - message: string (original message that was signed)
 * 
 * Returns:
 * - user: User object (created if new)
 * - token: Session token or JWT (optional)
 * 
 * WORKFLOW:
 * 1. Verify the signature matches the wallet address
 * 2. Get or create user
 * 3. Update last_login timestamp
 * 4. Return user info (and session token if using sessions)
 * 
 * TODO: Implement wallet authentication
 */
router.post('/auth', async (req: Request, res: Response) => {
    try {
        const { walletAddress, signature, message } = req.body as AuthBody;

        // Validate required fields
        // if (!walletAddress || !signature || !message) {
        //     return res.status(400).json({ 
        //         error: 'walletAddress, signature, and message are required' 
        //     });
        // }

        // Validate wallet address format
        // if (!isValidSuiAddress(walletAddress)) {
        //     return res.status(400).json({ error: 'Invalid wallet address' });
        // }

        // Verify signature
        // const isValid = await verifyWalletSignature(walletAddress, signature, message);
        // if (!isValid) {
        //     return res.status(401).json({ error: 'Invalid signature' });
        // }

        // Get or create user
        // let user = await findUserByWallet(walletAddress);
        // if (!user) {
        //     user = await createUser(walletAddress, 'buyer');
        // }

        // Update last login
        // await updateLastLogin(user.id);

        // Generate session token (optional)
        // const token = generateSessionToken(user);

        // return res.json({ user, token });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error authenticating:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * PUT /api/v1/users/me
 * Update current user's profile
 * 
 * Body:
 * - displayName: string
 * - email: string
 * 
 * TODO: Implement profile update
 */
router.put('/me', authenticateWallet, async (req: Request, res: Response) => {
    try {
        const body = req.body as UpdateProfileBody;

        // Validate email format if provided
        // if (body.email && !isValidEmail(body.email)) {
        //     return res.status(400).json({ error: 'Invalid email format' });
        // }

        // Get current user
        // const walletAddress = req.user.walletAddress;
        // const user = await findUserByWallet(walletAddress);

        // if (!user) {
        //     return res.status(404).json({ error: 'User not found' });
        // }

        // Update user
        // const updatedUser = await updateUser(user.id, {
        //     display_name: body.displayName,
        //     email: body.email
        // });

        // return res.json({ user: updatedUser });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * GET /api/v1/users/:address
 * Get public user profile by wallet address
 * 
 * Returns:
 * - Public user info
 * - Agent info if applicable
 * 
 * TODO: Implement public profile retrieval
 */
router.get('/:address', async (req: Request, res: Response) => {
    try {
        const { address } = req.params;

        // Validate address format
        // if (!isValidSuiAddress(address)) {
        //     return res.status(400).json({ error: 'Invalid wallet address' });
        // }

        // Get user
        // const user = await findUserByWallet(address);

        // if (!user) {
        //     return res.status(404).json({ error: 'User not found' });
        // }

        // Get public info only
        // const publicProfile = {
        //     walletAddress: user.wallet_address,
        //     displayName: user.display_name,
        //     role: user.role,
        //     createdAt: user.created_at
        // };

        // Add agent info if applicable
        // if (user.role === 'agent') {
        //     const agentInfo = await getAgentByUserId(user.id);
        //     publicProfile.agentInfo = {
        //         skills: agentInfo.skills,
        //         rating: agentInfo.rating,
        //         jobsCompleted: agentInfo.jobs_completed
        //     };
        // }

        // return res.json({ profile: publicProfile });

        res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Verify wallet signature
 * 
 * @param walletAddress - The wallet address that signed
 * @param signature - The signature
 * @param message - The original message
 * @returns true if signature is valid
 * 
 * TODO: Implement with SUI SDK
 */
async function verifyWalletSignature(
    walletAddress: string,
    signature: string,
    message: string
): Promise<boolean> {
    // Use SUI SDK to verify signature
    // import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
    // 
    // const isValid = await verifyPersonalMessageSignature(
    //     new TextEncoder().encode(message),
    //     signature,
    //     walletAddress
    // );
    // return isValid;

    return false;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export default router;
