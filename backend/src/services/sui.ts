/**
 * =============================================================================
 * SUI Blockchain Service - Smart Contract Interactions
 * =============================================================================
 * 
 * This module handles all interactions with the SUI blockchain:
 * - Creating escrow locks
 * - Releasing escrow to agents
 * - Cancelling escrows
 * - Reading escrow state
 * 
 * REQUIREMENTS:
 * - SUI private key for signing transactions
 * - Escrow package ID (after publishing the Move contract)
 * - SUI RPC endpoint (testnet/mainnet)
 * 
 * =============================================================================
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import dotenv from 'dotenv';
import { platform } from 'os';

dotenv.config();
const usdc_coin_type = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';    
// =============================================================================
// TYPES
// =============================================================================

export interface EscrowCreationParams {
    /** Buyer's wallet address */
    buyerAddress: string;
    /** Agent's wallet address */
    agentAddress: string;
    /** Amount of USDC to lock */
    amountUsdc: number;
    /** Job reference key for tracking */
    jobReference: string;
    /** USDC coin object ID to use for payment */
    usdcCoinId: string;
}

export interface EscrowCreationResult {
    /** Transaction digest */
    txDigest: string;
    /** Object ID of the created LockedPayment */
    escrowObjectId: string;
    /** Success status */
    success: boolean;
    /** Error message if failed */
    error?: string;
}

export interface EscrowReleaseParams {
    /** Object ID of the LockedPayment to release */
    escrowObjectId: string;
    /** Buyer must sign (must match escrow.buyer) */
    buyerAddress: string;
}

export interface EscrowReleaseResult {
    txDigest: string;
    success: boolean;
    error?: string;
}

export interface EscrowState {
    objectId: string;
    buyer: string;
    agent: string;
    amount: number;
    status: 'locked' | 'released' | 'cancelled';
    jobReference: string;
    createdAt: number;
}

// =============================================================================
// CLIENT INSTANCE
// =============================================================================

let suiClient: SuiClient | null = null;
let platformKeypair: Ed25519Keypair | null = null;

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get SUI network configuration
 */
function getSuiNetwork(): 'testnet' | 'devnet' | 'mainnet' | 'localnet' {
    const network = process.env.SUI_NETWORK || 'testnet';
    return network as 'testnet' | 'devnet' | 'mainnet' | 'localnet';
}

/**
 * Get the escrow package ID from environment
 */
function getEscrowPackageId(): string {
    const packageId = process.env.SUI_ESCROW_PACKAGE_ID;
    if (!packageId) {
        throw new Error('SUI_ESCROW_PACKAGE_ID environment variable is required');
    }
    return packageId;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize SUI client and platform keypair
 */
export async function initializeSuiClient(): Promise<void> {
    // Create client
    const network = getSuiNetwork();
    const rpcUrl = getFullnodeUrl(network);
    suiClient = new SuiClient({ url: rpcUrl });

    // Load platform keypair for signing transactions
    const privateKeyBech32 = process.env.SUI_PRIVATE_KEY;
    if (privateKeyBech32) {
        platformKeypair = Ed25519Keypair.fromSecretKey(privateKeyBech32);
    }

    // Verify connection
    const chainId = await suiClient.getChainIdentifier();
    console.log(`[SUI] Connected to ${network} (chainId: ${chainId})`);
}

/**
 * Get the SUI client instance
 */
export function getSuiClient(): SuiClient {
    if (!suiClient) {
        throw new Error('SUI client not initialized. Call initializeSuiClient() first.');
    }
    return suiClient;
}

// =============================================================================
// ESCROW OPERATIONS
// =============================================================================

/**
 * Create escrow by locking USDC in the smart contract
 */
export async function createEscrow(
    params: EscrowCreationParams
): Promise<EscrowCreationResult> {
    const client = getSuiClient();
    const packageId = getEscrowPackageId();

    const tx = new Transaction();
    tx.moveCall({
        target: `${packageId}::escrow::create_escrow`,
        typeArguments: [usdc_coin_type],
        arguments: [
            tx.object(params.usdcCoinId),
            tx.pure.address(params.agentAddress),
            tx.pure.string(params.jobReference),           
        ],
    })

    // Sign and execute transaction
    if (!platformKeypair) {
        throw new Error('Platform keypair not available');
    }

    const signature = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: platformKeypair,
        options: {
            showEffects: true,
            showObjectChanges: true,
        }
    });

    // Extract escrow object ID from created objects
    const createdObjects = signature.effects?.created || [];
    const escrowObjects = createdObjects.find(obj => 
        obj.reference.objectId === usdc_coin_type
    );

    if (!escrowObjects) {
        throw new Error('Escrow object not found');
    }

    return {
        txDigest: signature.digest,
        escrowObjectId: escrowObjects.reference.objectId,
        success: signature.effects?.status?.status === 'success',
        error: signature.effects?.status?.error
    };
}

/**
 * Release escrow funds to the agent
 */
export async function releaseEscrow(
    params: EscrowReleaseParams
): Promise<EscrowReleaseResult> {
    const client = getSuiClient();
    const packageId = getEscrowPackageId();

    // Build transaction
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageId}::escrow::release_escrow`,
        typeArguments: [usdc_coin_type],
        arguments: [
            tx.object(params.escrowObjectId),
        ],
    });

    // Sign and execute transaction
    if (!platformKeypair) {
        throw new Error('Platform keypair not available');
    }

    const signature = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: platformKeypair,
        options: {
            showEffects: true,
            showObjectChanges: true,
        }
    });

    return {
        txDigest: signature.digest,
        success: signature.effects?.status?.status === 'success',
        error: signature.effects?.status?.error
    };
}

/**
 * Cancel escrow and return funds to buyer
 */
export async function cancelEscrow(
    escrowObjectId: string
): Promise<EscrowReleaseResult> {
    const client = getSuiClient();
    const packageId = getEscrowPackageId();

    // Build transaction
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageId}::escrow::cancel_escrow`,
        typeArguments: [usdc_coin_type],
        arguments: [
            tx.object(escrowObjectId),
        ],
    });

    // Sign and execute transaction
    if (!platformKeypair) {
        throw new Error('Platform keypair not available');
    }

    const signature = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: platformKeypair,
        options: {
            showEffects: true,
            showObjectChanges: true,
        }
    });

    return {
        txDigest: signature.digest,
        success: signature.effects?.status?.status === 'success',
        error: signature.effects?.status?.error
    };
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get escrow state by object ID
 */
export async function getEscrowState(
    escrowObjectId: string
): Promise<EscrowState | null> {
    const client = getSuiClient();

    const object = await client.getObject({
        id: escrowObjectId,
        options: {
            showContent: true,
            showType: true,
        }
    });

    if (!object.data || object.error) {
        return null;
    }

    // Parse the Move struct fields
    const content = object.data.content;
    if (content?.dataType !== 'moveObject') {
        return null;
    }

    const fields = content.fields as any;
    
    return {
        objectId: escrowObjectId,
        buyer: fields.buyer,
        agent: fields.agent,
        amount: parseInt(fields.balance?.value || '0'),
        status: parseStatus(fields.status),
        jobReference: Buffer.from(fields.job_reference).toString('utf8'),
        createdAt: parseInt(fields.created_at)
    };
}

/**
 * Get all escrows for a buyer using SUI GraphQL
 */
export async function getEscrowsByBuyer(
    buyerAddress: string
): Promise<EscrowState[]> {
    const packageId = getEscrowPackageId();
    const network = getSuiNetwork();
    
    // SUI GraphQL endpoint
    const graphqlEndpoint = `https://sui-${network}.mystenlabs.com/graphql`;
    
    // GraphQL query to get all LockedPayment objects
    const query = `
        query GetEscrows($type: String!) {
            objects(filter: { type: $type }) {
                nodes {
                    address
                    version
                    contents {
                        json
                    }
                }
            }
        }
    `;

    const variables = {
        type: `${packageId}::escrow::LockedPayment<${usdc_coin_type}>`
    };

    try {
        const response = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`GraphQL failed: ${response.statusText}`);
        }

        const result: any = await response.json();
        
        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return [];
        }

        const objects = result.data?.objects?.nodes || [];
        const escrows: EscrowState[] = [];

        for (const obj of objects) {
            if (!obj.contents?.json) continue;

            const fields = obj.contents.json;

            // Filter by buyer field
            if (fields.buyer !== buyerAddress) continue;

            escrows.push({
                objectId: obj.address,
                buyer: fields.buyer,
                agent: fields.agent,
                amount: parseInt(fields.balance?.value || '0'),
                status: parseStatus(parseInt(fields.status)),
                jobReference: Buffer.from(fields.job_reference || []).toString('utf8'),
                createdAt: parseInt(fields.created_at || '0')
            });
        }

        return escrows;
    } catch (error) {
        console.error('Error querying escrows via GraphQL:', error);
        return [];
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Parse escrow status from u8 to string
 */
function parseStatus(statusCode: number): EscrowState['status'] {
    switch (statusCode) {
        case 0: return 'locked';
        case 1: return 'released';
        case 2: return 'cancelled';
        default: return 'locked';
    }
}

/**
 * Build a transaction for client-side signing
 */
export async function buildClientTransaction(
    escrowObjectId: string,
    operation: 'release' | 'cancel'
): Promise<string> {
    const client = getSuiClient();
    const packageId = getEscrowPackageId();
    
    const tx = new Transaction();

    // Select the appropriate function
    const target = operation === 'release' 
        ? `${packageId}::escrow::release_escrow`
        : `${packageId}::escrow::cancel_escrow`;

    // Build the move call
    tx.moveCall({
        target,
        typeArguments: [usdc_coin_type],
        arguments: [
            tx.object(escrowObjectId)
        ],
    });

    // Set gas budget (optional, wallet will set if not provided)
    tx.setGasBudget(10000000); // 0.01 SUI

    // Serialize transaction for client-side signing
    const bytes = await tx.build({ 
        client,
        // Don't sign here - client will sign
        onlyTransactionKind: false
    });
    
    // Return as base64 string for easy transport
    return Buffer.from(bytes).toString('base64');
}

/**
 * Check SUI client health
 */
export async function checkSuiHealth(): Promise<boolean> {
    try {
        const client = getSuiClient();
        await client.getLatestCheckpointSequenceNumber();
        return true;
    } catch {
        return false;
    }
}
