/**
 * Shared Agent Service - MVP Version
 * Single agent shared by all users for simplicity
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// Configuration
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
const SUI_FULLNODE = process.env.SUI_FULLNODE || getFullnodeUrl(SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet');

let sharedAgent: {
    keypair: Ed25519Keypair;
    address: string;
    privateKey: string;
    client: SuiClient;
} | null = null;

/**
 * Initialize the shared agent from environment variable
 */
export function initializeSharedAgent(): void {
    const privateKeyBech32 = process.env.AGENT_PRIVATE_KEY || process.env.SUI_PRIVATE_KEY;
    const client = new SuiClient({ url: SUI_FULLNODE });

    if (!privateKeyBech32) {
        console.log('[SharedAgent] No AGENT_PRIVATE_KEY found - generating test agent');
        // Create a new random keypair for development/testing
        const keypair = new Ed25519Keypair();
        sharedAgent = {
            keypair,
            address: keypair.toSuiAddress(),
            privateKey: keypair.getSecretKey(),
            client
        };
        console.log('[SharedAgent] Test agent created with random keypair');
    } else {
        // Use provided private key
        try {
            const keypair = Ed25519Keypair.fromSecretKey(privateKeyBech32);
            sharedAgent = {
                keypair,
                address: keypair.toSuiAddress(),
                privateKey: keypair.getSecretKey(),
                client
            };
            console.log('[SharedAgent] Loaded from PRIVATE_KEY');
        } catch (error) {
            console.error('[SharedAgent] Failed to load private key:', error);
            throw new Error('Invalid PRIVATE_KEY format.');
        }
    }
    
    console.log(`[SharedAgent] Initialized - Address: ${sharedAgent.address}`);
    console.log(`[SharedAgent] Network: ${SUI_NETWORK}`);
}

/**
 * Get SUI Balance of the Shared Agent
 */
export async function getSharedAgentBalance(): Promise<{ totalBalance: number, formatted: string }> {
    if (!sharedAgent) throw new Error('Shared agent not initialized');

    const balance = await sharedAgent.client.getBalance({
        owner: sharedAgent.address
    });

    const totalBalance = parseInt(balance.totalBalance);
    // SUI has 9 decimals
    const formatted = (totalBalance / 1_000_000_000).toFixed(4);

    return { totalBalance, formatted };
}

/**
 * Transfer SUI from Shared Agent to Recipient
 * @param recipientAddress Wallet address of the receiver
 * @param amountInSui Amount to transfer (e.g. 0.01)
 */
export async function transferSuiToAgent(recipientAddress: string, amountInSui: number): Promise<string> {
    if (!sharedAgent) throw new Error('Shared agent not initialized');

    console.log(`[SharedAgent] Initiating transfer of ${amountInSui} SUI to ${recipientAddress}`);

    const tx = new Transaction();
    
    // Convert SUI to MIST (1 SUI = 10^9 MIST)
    const amountInMist = BigInt(Math.floor(amountInSui * 1_000_000_000));
    
    // Create coin with specific amount
    const [coin] = tx.splitCoins(tx.gas, [amountInMist]);
    
    // Transfer the coin
    tx.transferObjects([coin], recipientAddress);

    // Sign and execute
    const result = await sharedAgent.client.signAndExecuteTransaction({
        signer: sharedAgent.keypair,
        transaction: tx,
        options: {
            showEffects: true,
            showEvents: true
        }
    });

    if (result.effects?.status.status !== 'success') {
        throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }

    console.log(`[SharedAgent] Transfer successful. Digest: ${result.digest}`);
    return result.digest;
}

export function getSharedAgentKeypair(): Ed25519Keypair {
    if (!sharedAgent) throw new Error('Shared agent not initialized.');
    return sharedAgent.keypair;
}

export function getSharedAgentAddress(): string {
    if (!sharedAgent) throw new Error('Shared agent not initialized.');
    return sharedAgent.address;
}

export function getSharedAgentPrivateKey(): string {
    if (!sharedAgent) throw new Error('Shared agent not initialized.');
    return sharedAgent.privateKey;
}

export function isSharedAgentInitialized(): boolean {
    return sharedAgent !== null;
}
