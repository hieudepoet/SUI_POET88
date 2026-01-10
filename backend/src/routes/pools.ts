/**
 * Pool Routes - User Fund Pool Management
 * 
 * Endpoints:
 * - POST   /api/pools                    Create pool
 * - GET    /api/pools/user/:userId       Get user's pool
 * - POST   /api/pools/:poolId/deposit    Record deposit
 * - POST   /api/pools/:poolId/withdraw   Record withdrawal
 * - GET    /api/pools/:poolId/stats      Get pool stats
 * - GET    /api/pools/:poolId/transactions Get transaction history
 * - POST   /api/pools/:poolId/agent-spend  Agent spend from pool
 */

import { Router, Request, Response } from 'express';
import {
    recordPoolCreation,
    buildDepositTransaction,
    recordDeposit,
    buildWithdrawTransaction,
    recordWithdrawal,
    getPoolStats,
    syncPoolBalance,
    buildCreatePoolTransaction
} from '../services/pool.js';
import {
    getPoolByUser,
    getPoolTransactions,
    getPoolByObjectId
} from '../db/queries.js';

const router = Router();

// =============================================================================
// POOL CREATION
// =============================================================================

/**
 * POST /api/pools/build-create
 * Build transaction for pool creation (user signs client-side)
 */
router.post('/build-create', async (req: Request, res: Response) => {
    try {
        const { agentAddress, initialCoinId, spendingLimit } = req.body;

        if (!agentAddress || !initialCoinId || !spendingLimit) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: agentAddress, initialCoinId, spendingLimit'
            });
        }

        const txBytes = await buildCreatePoolTransaction(
            agentAddress,
            initialCoinId,
            parseFloat(spendingLimit)
        );

        res.json({
            success: true,
            txBytes,
            message: 'Sign this transaction with your wallet'
        });

    } catch (error: any) {
        console.error('Error building create pool transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pools/record
 * Record pool creation after user has signed and executed transaction
 */
router.post('/record', async (req: Request, res: Response) => {
    try {
        const {
            userId,
            poolObjectId,
            poolAddress,
            agentAddress,
            spendingLimit,
            txDigest,
            initialDeposit
        } = req.body;

        if (!userId || !poolObjectId || !poolAddress || !agentAddress || !spendingLimit || !txDigest) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const pool = await recordPoolCreation(
            parseInt(userId),
            poolObjectId,
            poolAddress,
            agentAddress,
            parseFloat(spendingLimit),
            txDigest,
            parseFloat(initialDeposit || 0)
        );

        res.json({
            success: true,
            pool
        });

    } catch (error: any) {
        console.error('Error recording pool creation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// POOL QUERIES
// =============================================================================

/**
 * GET /api/pools/user/:userId
 * Get user's pool information
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const pool = await getPoolByUser(userId);

        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found for this user'
            });
        }

        res.json({
            success: true,
            pool
        });

    } catch (error: any) {
        console.error('Error getting pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/pools/:poolId/stats
 * Get comprehensive pool statistics
 */
router.get('/:poolId/stats', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;

        // Try to get by object ID first
        const pool = await getPoolByObjectId(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }

        const stats = await getPoolStats(pool.user_id);

        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Stats not available'
            });
        }

        res.json({
            success: true,
            stats
        });

    } catch (error: any) {
        console.error('Error getting pool stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/pools/:poolId/transactions
 * Get pool transaction history
 */
router.get('/:poolId/transactions', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const pool = await getPoolByObjectId(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }

        const transactions = await getPoolTransactions(pool.id, limit);

        res.json({
            success: true,
            transactions,
            count: transactions.length
        });

    } catch (error: any) {
        console.error('Error getting pool transactions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// DEPOSITS & WITHDRAWALS
// =============================================================================

/**
 * POST /api/pools/:poolId/deposit/build
 * Build deposit transaction
 */
router.post('/:poolId/deposit/build', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;
        const { coinId } = req.body;

        if (!coinId) {
            return res.status(400).json({
                success: false,
                error: 'coinId required'
            });
        }

        const txBytes = await buildDepositTransaction(poolId, coinId);

        res.json({
            success: true,
            txBytes,
            message: 'Sign this transaction to deposit'
        });

    } catch (error: any) {
        console.error('Error building deposit transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pools/:poolId/deposit/record
 * Record deposit after transaction executed
 */
router.post('/:poolId/deposit/record', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;
        const { amount, txDigest } = req.body;

        if (!amount || !txDigest) {
            return res.status(400).json({
                success: false,
                error: 'amount and txDigest required'
            });
        }

        await recordDeposit(poolId, parseFloat(amount), txDigest);

        res.json({
            success: true,
            message: 'Deposit recorded successfully'
        });

    } catch (error: any) {
        console.error('Error recording deposit:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pools/:poolId/withdraw/build
 * Build withdrawal transaction
 */
router.post('/:poolId/withdraw/build', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;
        const { amount } = req.body;

        if (!amount) {
            return res.status(400).json({
                success: false,
                error: 'amount required'
            });
        }

        const txBytes = await buildWithdrawTransaction(poolId, parseFloat(amount));

        res.json({
            success: true,
            txBytes,
            message: 'Sign this transaction to withdraw'
        });

    } catch (error: any) {
        console.error('Error building withdrawal transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pools/:poolId/withdraw/record
 * Record withdrawal after transaction executed
 */
router.post('/:poolId/withdraw/record', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;
        const { amount, txDigest } = req.body;

        if (!amount || !txDigest) {
            return res.status(400).json({
                success: false,
                error: 'amount and txDigest required'
            });
        }

        await recordWithdrawal(poolId, parseFloat(amount), txDigest);

        res.json({
            success: true,
            message: 'Withdrawal recorded successfully'
        });

    } catch (error: any) {
        console.error('Error recording withdrawal:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// POOL MANAGEMENT
// =============================================================================

/**
 * POST /api/pools/:poolId/sync
 * Sync pool balance from blockchain
 */
router.post('/:poolId/sync', async (req: Request, res: Response) => {
    try {
        const { poolId } = req.params;

        await syncPoolBalance(poolId);

        const pool = await getPoolByObjectId(poolId);

        res.json({
            success: true,
            message: 'Balance synced successfully',
            pool
        });

    } catch (error: any) {
        console.error('Error syncing pool balance:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
