/**
 * =============================================================================
 * User Pool Service - User Fund Pool Management
 * =============================================================================
 * 
 * Manages user's personal fund pools for autonomous agent operations
 * 
 * Key Responsibilities:
 * - Create pools on blockchain and database
 * - Handle deposits and withdrawals
 * - Enable agent spending from pools
 * - Sync pool state between blockchain and database
 * 
 * =============================================================================
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import {
    createUserPool as dbCreateUserPool,
    getPoolByUser,
    getPoolByObjectId,
    updatePoolBalance,
    createPoolTransaction,
    getPoolTransactions,
    deactivatePool,
    UserPool,
    PoolTransaction
} from '../db/queries.js';
import { getSuiClient } from './sui.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreatePoolParams {
    userId: number;
    userAddress: string;
    agentAddress: string;
    initialDepositUsdc: number;
    spendingLimit: number;
    usdcCoinId: string;  // User's USDC coin for initial deposit
}

export interface CreatePoolResult {
    success: boolean;
    poolObjectId?: string;
    poolAddress?: string;
    txDigest?: string;
    dbPool?: UserPool;
    error?: string;
}

export interface DepositParams {
    poolObjectId: string;
    userAddress: string;
    amountUsdc: number;
    usdcCoinId: string;
}

export interface AgentSpendParams {
    poolObjectId: string;
    agentKeypair: Ed25519Keypair;
    amountUsdc: number;
    purpose: string;
    jobId?: number;
}

export interface PoolStats {
    pool: UserPool;
    recentTransactions: PoolTransaction[];
    onChainBalance?: number;
    syncStatus: 'synced' | 'out_of_sync';
}

// =============================================================================
// CONFIGURATION
// =============================================================================

function getPoolPackageId(): string {
    const packageId = process.env.SUI_POOL_PACKAGE_ID || process.env.SUI_ESCROW_PACKAGE_ID;
    if (!packageId) {
        throw new Error('SUI_POOL_PACKAGE_ID not configured');
    }
    return packageId;
}

function getUsdcCoinType(): string {
    return process.env.USDC_COIN_TYPE || '0x2::sui::SUI';
}

// =============================================================================
// POOL CREATION
// =============================================================================

/**
 * Create a new user pool on blockchain and database
 * 
 * Steps:
 * 1. Call smart contract to create pool
 * 2. Agent capability is automatically transferred to agent
 * 3. Pool is shared for both user and agent access
 * 4. Record pool in database
 */
export async function createPool(params: CreatePoolParams): Promise<CreatePoolResult> {
    try {
        console.log(`[PoolService] Creating pool for user ${params.userId}...`);

        const client = getSuiClient();
        const packageId = getPoolPackageId();
        const coinType = getUsdcCoinType();

        // Build transaction
        const tx = new Transaction();

        // Convert USDC amount to smallest unit (6 decimals)
        const amountInSmallestUnit = Math.floor(params.initialDepositUsdc * 1_000_000);
        const spendingLimitInSmallestUnit = Math.floor(params.spendingLimit * 1_000_000);

        // Call create_pool function
        tx.moveCall({
            target: `${packageId}::user_pool::create_pool`,
            typeArguments: [coinType],
            arguments: [
                tx.pure.address(params.agentAddress),
                tx.object(params.usdcCoinId),
                tx.pure.u64(spendingLimitInSmallestUnit)
            ]
        });

        // User signs and executes
        const txBytes = await tx.build({ client });

        console.log('[PoolService] Transaction built, needs user signature');

        return {
            success: false,
            error: 'Transaction requires user signature. Use buildCreatePoolTransaction() for client-side signing.'
        };

    } catch (error) {
        console.error('[PoolService] Error creating pool:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Build transaction for client-side pool creation
 * Returns serialized transaction bytes that user can sign with their wallet
 */
export async function buildCreatePoolTransaction(
    agentAddress: string,
    initialDepositCoinId: string,
    spendingLimit: number
): Promise<string> {
    const client = getSuiClient();
    const packageId = getPoolPackageId();
    const coinType = getUsdcCoinType();

    const tx = new Transaction();
    const spendingLimitInSmallestUnit = Math.floor(spendingLimit * 1_000_000);

    tx.moveCall({
        target: `${packageId}::user_pool::create_pool`,
        typeArguments: [coinType],
        arguments: [
            tx.pure.address(agentAddress),
            tx.object(initialDepositCoinId),
            tx.pure.u64(spendingLimitInSmallestUnit)
        ]
    });

    const txBytes = await tx.build({ client });
    return Buffer.from(txBytes).toString('base64');
}

/**
 * Record pool creation in database after user executes transaction
 */
export async function recordPoolCreation(
    userId: number,
    poolObjectId: string,
    poolAddress: string,
    agentAddress: string,
    spendingLimit: number,
    txDigest: string,
    initialDepositUsdc: number
): Promise<UserPool> {
    console.log(`[PoolService] Recording pool ${poolObjectId} in database...`);

    // Get blockchain timestamp
    const client = getSuiClient();
    const poolObject: any = await client.getObject({
        id: poolObjectId,
        options: { showContent: true }
    });

    const createdAt = poolObject.data?.content?.fields?.created_at || Date.now();

    // Create database record
    const dbPool = await dbCreateUserPool(
        userId,
        poolAddress,
        poolObjectId,
        agentAddress,
        spendingLimit,
        Number(createdAt)
    );

    // Record initial deposit transaction
    await createPoolTransaction(
        dbPool.id,
        'deposit',
        initialDepositUsdc,
        txDigest,
        undefined,
        'Initial pool deposit'
    );

    // Update pool balance
    await updatePoolBalance(dbPool.id, initialDepositUsdc, initialDepositUsdc, 0);

    console.log(`[PoolService] ✅ Pool ${poolObjectId} recorded successfully`);
    return dbPool;
}

// =============================================================================
// DEPOSITS & WITHDRAWALS
// =============================================================================

/**
 * Build deposit transaction for user
 */
export async function buildDepositTransaction(
    poolObjectId: string,
    depositCoinId: string
): Promise<string> {
    const client = getSuiClient();
    const packageId = getPoolPackageId();
    const coinType = getUsdcCoinType();

    const tx = new Transaction();

    tx.moveCall({
        target: `${packageId}::user_pool::deposit`,
        typeArguments: [coinType],
        arguments: [
            tx.object(poolObjectId),
            tx.object(depositCoinId)
        ]
    });

    const txBytes = await tx.build({ client });
    return Buffer.from(txBytes).toString('base64');
}

/**
 * Record deposit after user executes transaction
 */
export async function recordDeposit(
    poolObjectId: string,
    amountUsdc: number,
    txDigest: string
): Promise<void> {
    const dbPool = await getPoolByObjectId(poolObjectId);
    if (!dbPool) {
        throw new Error(`Pool ${poolObjectId} not found in database`);
    }

    // Record transaction
    await createPoolTransaction(
        dbPool.id,
        'deposit',
        amountUsdc,
        txDigest,
        undefined,
        'User deposit'
    );

    // Update balance
    const newBalance = dbPool.balance_usdc + amountUsdc;
    const newTotalDeposited = dbPool.total_deposited + amountUsdc;
    await updatePoolBalance(dbPool.id, newBalance, newTotalDeposited);

    console.log(`[PoolService] ✅ Deposit of ${amountUsdc} USDC recorded for pool ${poolObjectId}`);
}

/**
 * Build withdraw transaction for user
 */
export async function buildWithdrawTransaction(
    poolObjectId: string,
    amountUsdc: number
): Promise<string> {
    const client = getSuiClient();
    const packageId = getPoolPackageId();
    const coinType = getUsdcCoinType();

    const tx = new Transaction();
    const amountInSmallestUnit = Math.floor(amountUsdc * 1_000_000);

    tx.moveCall({
        target: `${packageId}::user_pool::withdraw`,
        typeArguments: [coinType],
        arguments: [
            tx.object(poolObjectId),
            tx.pure.u64(amountInSmallestUnit)
        ]
    });

    const txBytes = await tx.build({ client });
    return Buffer.from(txBytes).toString('base64');
}

/**
 * Record withdrawal after user executes transaction
 */
export async function recordWithdrawal(
    poolObjectId: string,
    amountUsdc: number,
    txDigest: string
): Promise<void> {
    const dbPool = await getPoolByObjectId(poolObjectId);
    if (!dbPool) {
        throw new Error(`Pool ${poolObjectId} not found in database`);
    }

    // Record transaction
    await createPoolTransaction(
        dbPool.id,
        'withdraw',
        amountUsdc,
        txDigest,
        undefined,
        'User withdrawal'
    );

    // Update balance
    const newBalance = dbPool.balance_usdc - amountUsdc;
    await updatePoolBalance(dbPool.id, newBalance);

    console.log(`[PoolService] ✅ Withdrawal of ${amountUsdc} USDC recorded for pool ${poolObjectId}`);
}

// =============================================================================
// AGENT SPENDING
// =============================================================================

/**
 * Agent spends from pool (server-side with agent keypair)
 * This is used by the autonomous agent to create escrows
 */
export async function agentSpendFromPool(
    params: AgentSpendParams
): Promise<{ success: boolean; coinObjectId?: string; txDigest?: string; error?: string }> {
    try {
        console.log(`[PoolService] Agent spending ${params.amountUsdc} USDC from pool ${params.poolObjectId}`);

        const client = getSuiClient();
        const packageId = getPoolPackageId();
        const coinType = getUsdcCoinType();

        // Get agent capability (should be owned by agent)
        const agentAddress = params.agentKeypair.toSuiAddress();
        const objects = await client.getOwnedObjects({
            owner: agentAddress,
            filter: {
                StructType: `${packageId}::user_pool::AgentCapability`
            }
        });

        if (!objects.data || objects.data.length === 0) {
            throw new Error('Agent capability not found');
        }

        const capabilityId = objects.data[0].data?.objectId;
        if (!capabilityId) {
            throw new Error('Invalid capability object');
        }

        const tx = new Transaction();
        const amountInSmallestUnit = Math.floor(params.amountUsdc * 1_000_000);
        const purposeBytes = Array.from(new TextEncoder().encode(params.purpose));

        // Call agent_spend - returns a Coin
        const [spentCoin] = tx.moveCall({
            target: `${packageId}::user_pool::agent_spend`,
            typeArguments: [coinType],
            arguments: [
                tx.object(params.poolObjectId),
                tx.object(capabilityId),
                tx.pure.u64(amountInSmallestUnit),
                tx.pure(bcs.vector(bcs.u8()).serialize(purposeBytes))
            ]
        });

        // Transfer coin to agent (for now, agent will use it for escrow)
        tx.transferObjects([spentCoin], agentAddress);

        // Execute transaction
        const result = await client.signAndExecuteTransaction({
            signer: params.agentKeypair as any,
            transaction: tx as any,
            options: {
                showEffects: true,
                showObjectChanges: true
            }
        });

        // Find the created coin object
        const createdCoin = result.objectChanges?.find(
            (change: any) => change.type === 'created' && change.objectType?.includes('Coin')
        );

        if (!createdCoin || !('objectId' in createdCoin)) {
            throw new Error('Failed to get spent coin object ID');
        }

        const coinObjectId = (createdCoin as any).objectId;
        const txDigest = result.digest;

        // Record in database
        const dbPool = await getPoolByObjectId(params.poolObjectId);
        if (dbPool) {
            await createPoolTransaction(
                dbPool.id,
                'spend',
                params.amountUsdc,
                txDigest,
                params.jobId,
                params.purpose
            );

            const newBalance = dbPool.balance_usdc - params.amountUsdc;
            const newTotalSpent = dbPool.total_spent + params.amountUsdc;
            await updatePoolBalance(dbPool.id, newBalance, undefined, newTotalSpent);
        }

        console.log(`[PoolService] ✅ Agent spent ${params.amountUsdc} USDC, coin: ${coinObjectId}`);

        return {
            success: true,
            coinObjectId,
            txDigest
        };

    } catch (error) {
        console.error('[PoolService] Error in agent spend:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// =============================================================================
// POOL STATE MANAGEMENT
// =============================================================================

/**
 * Sync pool balance from blockchain to database
 */
export async function syncPoolBalance(poolObjectId: string): Promise<void> {
    console.log(`[PoolService] Syncing pool ${poolObjectId} from blockchain...`);

    const client = getSuiClient();
    const poolObject: any = await client.getObject({
        id: poolObjectId,
        options: { showContent: true }
    });

    if (!poolObject.data) {
        throw new Error(`Pool ${poolObjectId} not found on blockchain`);
    }

    const fields = poolObject.data.content?.fields;
    const balanceField = fields?.balance;
    const onChainBalance = balanceField ? parseInt(balanceField) / 1_000_000 : 0;
    const totalDeposited = fields?.total_deposited ? parseInt(fields.total_deposited) / 1_000_000 : 0;
    const totalSpent = fields?.total_spent ? parseInt(fields.total_spent) / 1_000_000 : 0;

    // Update database
    const dbPool = await getPoolByObjectId(poolObjectId);
    if (dbPool) {
        await updatePoolBalance(dbPool.id, onChainBalance, totalDeposited, totalSpent);
        console.log(`[PoolService] ✅ Pool synced: balance=${onChainBalance} USDC`);
    }
}

/**
 * Get pool statistics with recent transactions
 */
export async function getPoolStats(userId: number): Promise<PoolStats | null> {
    const pool = await getPoolByUser(userId);
    if (!pool) {
        return null;
    }

    const recentTransactions = await getPoolTransactions(pool.id, 10);

    // Try to get on-chain balance
    let onChainBalance: number | undefined;
    let syncStatus: 'synced' | 'out_of_sync' = 'synced';

    try {
        const client = getSuiClient();
        const poolObject: any = await client.getObject({
            id: pool.pool_object_id,
            options: { showContent: true }
        });

        if (poolObject.data) {
            const balanceField = poolObject.data.content?.fields?.balance;
            onChainBalance = balanceField ? parseInt(balanceField) / 1_000_000 : 0;

            // Check if synced
            if (Math.abs(onChainBalance - pool.balance_usdc) > 0.01) {
                syncStatus = 'out_of_sync';
            }
        }
    } catch (error) {
        console.warn('[PoolService] Could not fetch on-chain balance:', error);
    }

    return {
        pool,
        recentTransactions,
        onChainBalance,
        syncStatus
    };
}

/**
 * Deactivate pool (marks as inactive in database)
 * Note: Pool on blockchain cannot be destroyed, but can be marked inactive
 */
export async function deactivateUserPool(poolObjectId: string): Promise<void> {
    const dbPool = await getPoolByObjectId(poolObjectId);
    if (!dbPool) {
        throw new Error(`Pool ${poolObjectId} not found`);
    }

    await deactivatePool(dbPool.id);
    console.log(`[PoolService] ✅ Pool ${poolObjectId} deactivated`);
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check pool service health
 */
export async function checkPoolServiceHealth(): Promise<boolean> {
    try {
        const packageId = getPoolPackageId();
        return !!packageId;
    } catch {
        return false;
    }
}
