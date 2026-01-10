/**
 * =============================================================================
 * Users Routes - API Endpoints for User Management
 * =============================================================================
 * 
 * Endpoints:
 * - POST   /api/v1/users/auth     - Authenticate/register with wallet
 * - GET    /api/v1/users/me       - Get current user profile
 * - PUT    /api/v1/users/me       - Update user profile
 * - GET    /api/v1/users/:address - Get public user by wallet address
 * 
 * =============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as queries from '../db/queries.js';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface AuthBody {
    walletAddress: string;
    signature?: string;
    message?: string;
}

interface UpdateProfileBody {
    displayName?: string;
    email?: string;
}

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                walletAddress: string;
                userId: number;
            };
        }
    }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Authentication middleware
 * TODO: Implement proper signature verification
 */
async function authenticateWallet(req: Request, res: Response, next: NextFunction) {
    try {
        const walletAddress = req.headers['x-wallet-address'] as string;
        
        if (!walletAddress) {
            return res.status(401).json({
                status: 401,
                error: true,
                message: 'Authentication required - missing x-wallet-address header',
            });
        }

        // Find user
        const user = await queries.findUserByWallet(walletAddress);
        
        if (!user) {
            return res.status(401).json({
                status: 401,
                error: true,
                message: 'User not found - please authenticate first',
            });
        }

        // Attach user to request
        req.user = {
            walletAddress: user.wallet_address,
            userId: user.id,
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Authentication failed',
        });
    }
}

/**
 * POST /api/v1/users/auth
 * Authenticate with wallet (signature verification optional for MVP)
 */
router.post('/auth', async (req: Request, res: Response) => {
    try {
        const { walletAddress, signature,message } = req.body as AuthBody;

        // Validate wallet address
        if (!walletAddress) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'walletAddress is required',
            });
        }

        // Validate SUI address format (basic check)
        // SUI addresses are 0x + 64 hex chars, but can be shorter when normalized
        if (!walletAddress.startsWith('0x') || walletAddress.length < 42 || walletAddress.length > 66) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid SUI wallet address format',
            });
        }

        // Verify signature if provided
        if (signature && message) {
            const isValid = await verifyWalletSignature(walletAddress, signature, message);
            if (!isValid) {
                return res.status(401).json({
                    status: 401,
                    error: true,
                    message: 'Invalid signature',
                });
            }
        }

        // Get or create user
        const user = await queries.getOrCreateUser(walletAddress);

        // TODO: Update last_login timestamp
        // await queries.updateLastLogin(user.id);

        // TODO: Generate session token/JWT if needed
        // const token = generateJWT(user);

        res.json({
            status: 200,
            error: false,
            message: 'Authentication successful',
            data: {
                user: {
                    id: user.id,
                    walletAddress: user.wallet_address,
                    role: user.role,
                    displayName: user.display_name,
                    createdAt: user.created_at,
                },
                // token, // Include if using JWT
            },
        });
    } catch (error) {
        console.error('Error authenticating:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Authentication failed',
        });
    }
});

/**
 * GET /api/v1/users/agent-wallet
 * Get deterministic agent wallet address for authenticated user
 * This wallet is auto-generated from the user's ID using HMAC-SHA256
 */
// router.get('/agent-wallet', authenticateWallet, async (req: Request, res: Response) => {
//     try {
//         const userId = req.user!.userId;
//         const agentAddress = getAgentAddress(userId);
        
//         res.json({
//             status: 200,
//             error: false,
//             message: 'Agent wallet retrieved successfully',
//             data: {
//                 userId,
//                 agentWalletAddress: agentAddress,
//                 note: 'This wallet is deterministically generated from your user ID. The private key is managed by the backend for autonomous agent operations.'
//             },
//         });
//     } catch (error) {
//         console.error('Error getting agent wallet:', error);
//         res.status(500).json({
//             status: 500,
//             error: true,
//             message: 'Failed to get agent wallet',
//         });
//     }
// });

/**
 * GET /api/v1/users/me
 * Get current authenticated user's profile
 */
router.get('/me', authenticateWallet, async (req: Request, res: Response) => {
    try {
        const walletAddress = req.user!.walletAddress;
        
        const user = await queries.findUserByWallet(walletAddress);

        if (!user) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'User not found',
            });
        }

        // TODO: Get agent info if role is 'agent'
        // let agentInfo = null;
        // if (user.role === 'agent') {
        //     agentInfo = await queries.getAgentByUserId(user.id);
        // }

        // TODO: Get user stats (jobs posted, completed, earnings)
        // const stats = {
        //     jobsPosted: await queries.countJobsByBuyer(user.id),
        //     jobsCompleted: await queries.countCompletedJobsByAgent(user.id),
        // };

        res.json({
            status: 200,
            error: false,
            message: 'Profile retrieved successfully',
            data: {
                user: {
                    id: user.id,
                    walletAddress: user.wallet_address,
                    role: user.role,
                    displayName: user.display_name,
                    email: user.email,
                    createdAt: user.created_at,
                    lastLogin: user.last_login,
                },
                // agentInfo,
                // stats,
            },
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get profile',
        });
    }
});

/**
 * PUT /api/v1/users/me
 * Update current user's profile
 */
router.put('/me', authenticateWallet, async (req: Request, res: Response) => {
    try {
        const { displayName, email } = req.body as UpdateProfileBody;

        // Validate email if provided
        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid email format',
            });
        }

        const userId = req.user!.userId;

        // TODO: Implement updateUser query
        // const updatedUser = await queries.updateUser(userId, {
        //     display_name: displayName,
        //     email,
        // });

        // For now, return success
        res.json({
            status: 200,
            error: false,
            message: 'Profile updated successfully (TODO: implement updateUser query)',
            data: {
                updated: {
                    displayName,
                    email,
                },
            },
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to update profile',
        });
    }
});

/**
 * GET /api/v1/users/:address
 * Get public user profile by wallet address
 */
router.get('/:address', async (req: Request, res: Response) => {
    try {
        const { address } = req.params;

        // Validate address format
        if (!address.startsWith('0x') || address.length < 42 || address.length > 66) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid SUI wallet address format',
            });
        }

        const user = await queries.findUserByWallet(address);

        if (!user) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'User not found',
            });
        }

        // Return only public info
        const publicProfile = {
            walletAddress: user.wallet_address,
            displayName: user.display_name,
            role: user.role,
            createdAt: user.created_at,
        };

        // TODO: Add agent info if role is 'agent'
        // if (user.role === 'agent') {
        //     const agentInfo = await queries.getAgentByUserId(user.id);
        //     publicProfile.agentInfo = {
        //         skills: agentInfo.skills,
        //         rating: agentInfo.rating,
        //         jobsCompleted: agentInfo.jobs_completed,
        //     };
        // }

        res.json({
            status: 200,
            error: false,
            message: 'Public profile retrieved successfully',
            data: {
                profile: publicProfile,
            },
        });
    } catch (error) {
        console.error('Error getting public profile:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get profile',
        });
    }
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Verify wallet signature (TODO: implement with SUI SDK)
 */
async function verifyWalletSignature(
    walletAddress: string,
    signature: string,
    message: string
): Promise<boolean> {
    // Use @mysten/sui to verify signature
    try {
        await verifyPersonalMessageSignature(
            new TextEncoder().encode(message),
            signature,
            { address: walletAddress }
        );
        return true;
    } catch (error) {
        console.error('Signature verification failed:', error);
        return false;
    }
}

export default router;
