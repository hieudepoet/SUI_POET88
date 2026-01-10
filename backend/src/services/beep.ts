/**
 * Beep MCP Integration - Official Implementation
 * 
 * Based on Beep's official MCP documentation:
 * https://api.justbeep.it/mcp
 * 
 * Session Workflow:
 * 1. Send initialize request WITHOUT session ID
 * 2. Server returns session ID in 'mcp-session-id' header
 * 3. Use session ID for ALL subsequent requests
 */

const BEEP_MCP_ENDPOINT = 'https://api.justbeep.it/mcp';
const BEEP_API_BASE = 'https://api.justbeep.it';

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

/**
 * Beep MCP Client - Properly implements session-based MCP protocol
 */
export class BeepMcpClient {
    private sessionId: string | undefined;
    private apiKey: string;
    private initialized = false;
    private initializing: Promise<void> | null = null;

    constructor() {
        this.apiKey = process.env.BEEP_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[BeepMCP] No API key configured');
        }
    }

    /**
     * Initialize MCP session
     * Step 1: Send initialize WITHOUT session ID
     * Step 2: Capture session ID from response header
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        if (this.initializing) return this.initializing;

        this.initializing = (async () => {
            console.log('[BeepMCP] Initializing session...');
            console.log('[BeepMCP] Endpoint:', BEEP_MCP_ENDPOINT);

            try {
                const response = await fetch(BEEP_MCP_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // NO mcp-session-id header on first request!
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'init',
                        method: 'initialize',
                        params: {
                            clientInfo: {
                                name: 'beeplancer-agent',
                                version: '1.0.0'
                            }
                        }
                    } as JsonRpcRequest)
                });

                // Debug: Log response status and headers
                console.log('[BeepMCP] Response status:', response.status, response.statusText);
                console.log('[BeepMCP] Response headers:');
                response.headers.forEach((value, key) => {
                    console.log(`  ${key}: ${value}`);
                });

                // Try to read response body
                const responseText = await response.text();
                console.log('[BeepMCP] Response body:', responseText.slice(0, 500));

                // CRITICAL: Capture session ID from header
                const sessionId = response.headers.get('mcp-session-id');
                if (sessionId) {
                    this.sessionId = sessionId;
                    console.log('[BeepMCP] Session initialized:', sessionId.slice(0, 16) + '...');
                    this.initialized = true;
                } else {
                    // Maybe the MCP endpoint doesn't exist or requires different approach
                    console.warn('[BeepMCP] No session ID returned');
                    console.warn('[BeepMCP] This might mean:');
                    console.warn('  1. Endpoint does not support MCP protocol');
                    console.warn('  2. Requires different authentication');
                    console.warn('  3. Documentation is outdated');
                    console.warn('[BeepMCP] Falling back to REST API only mode');
                    
                    // For MVP: Mark as "initialized" but without MCP support
                    this.initialized = true;
                    this.sessionId = undefined;
                }

                if (!response.ok && sessionId) {
                    throw new Error(`Initialize failed ${response.status}: ${responseText}`);
                }

                if (sessionId) {
                    try {
                        const data = JSON.parse(responseText) as JsonRpcResponse;
                        if (data.error) {
                            throw new Error(`Initialize error: ${data.error.message}`);
                        }
                    } catch (e) {
                        // Response might not be JSON if it's SSE or error page
                        console.warn('[BeepMCP] Response not JSON:', e);
                    }
                }

            } catch (error) {
                console.error('[BeepMCP] Initialization failed:', error);
                this.initializing = null;
                this.sessionId = undefined;
                // Don't throw - allow fallback to REST API
                this.initialized = true; // Mark as initialized to prevent retry loops
            }
        })();

        return this.initializing;
    }

    /**
     * List available tools
     */
    async listTools(): Promise<any[]> {
        await this.ensureInitialized();

        const response = await this.sendRequest({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
            params: {}
        });

        return response?.tools || [];
    }

    /**
     * Execute payment using requestAndPurchaseAsset tool
     */
    async requestAndPurchaseAsset(params: {
        amount: number;
        currency: 'USDC' | 'USDT' | 'SUI';
        referenceId: string;
    }): Promise<any> {
        await this.ensureInitialized();

        console.log(`[BeepMCP] Requesting payment: ${params.amount} ${params.currency}`);

        const response = await this.sendRequest({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
                name: 'requestAndPurchaseAsset',
                arguments: {
                    apiKey: this.apiKey, // API key goes in arguments!
                    amount: params.amount,
                    currency: params.currency,
                    referenceId: params.referenceId
                }
            }
        });

        console.log('[BeepMCP] Payment response:', response);
        return response;
    }

    /**
     * Access paid resource
     */
    async getPaidResource(params: {
        resourceId: string;
    }): Promise<any> {
        await this.ensureInitialized();

        return this.sendRequest({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
                name: 'getPaidResource',
                arguments: {
                    apiKey: this.apiKey,
                    resourceId: params.resourceId
                }
            }
        });
    }

    /**
     * Send JSON-RPC request with session ID
     */
    private async sendRequest(request: JsonRpcRequest): Promise<any> {
        if (!this.sessionId) {
            throw new Error('Not initialized - call initialize() first');
        }

        const response = await fetch(BEEP_MCP_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'mcp-session-id': this.sessionId // Session ID in header
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`MCP request failed ${response.status}: ${text}`);
        }

        const data = await response.json() as JsonRpcResponse;

        if (data.error) {
            throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
        }

        return data.result;
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}

/**
 * Beep Payment Service - REST API for invoice management
 */
export class BeepPaymentService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.BEEP_API_KEY || '';
    }

    async createInvoice(params: {
        amount: number;
        currency?: string;
        referenceKey: string;
        description?: string;
        generateQrCode?: boolean;
    }): Promise<any> {
        console.log(`[BeepAPI] Creating invoice: $${params.amount} ${params.currency || 'USDC'}`);

        const response = await fetch(`${BEEP_API_BASE}/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                amount: params.amount,
                currency: params.currency || 'USDC',
                referenceKey: params.referenceKey,
                description: params.description,
                generateQrCode: params.generateQrCode ?? true
            })
        });

        console.log('[BeepAPI] Invoice response:', response);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Beep API Error ${response.status}: ${text}`);
        }

        const data: any = await response.json();
        console.log('[BeepAPI] Invoice created:', data.id);
        return data;
    }

    async getInvoice(invoiceId: string): Promise<{
        id: string;
        status: 'pending' | 'paid' | 'expired' | 'cancelled';
        amount: number;
        currency: string;
        createdAt: string;
        expiresAt: string;
        paymentUrl?: string;
    }> {
        const response = await fetch(`${BEEP_API_BASE}/invoices/${invoiceId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Invoice ${invoiceId} not found`);
            }
            const text = await response.text();
            throw new Error(`Beep API Error ${response.status}: ${text}`);
        }

        const data: any = await response.json();
        return data;
    }
}

// Singleton instances
export const beepMcpClient = new BeepMcpClient();
export const beepPaymentService = new BeepPaymentService();

// Compatibility layer for existing code
export const beepMcpService = {
    async initialize() {
        return beepMcpClient.initialize();
    },

    async makePayment(params: {
        amount: number;
        currency: 'USDC' | 'USDT' | 'SUI';
        referenceId: string;
    }) {
        // Check if MCP is available
        if (beepMcpClient['sessionId']) {
            // MCP Mode: Use MCP tool
            try {
                console.log('[BeepMCP] Using MCP protocol for payment');
                const result = await beepMcpClient.requestAndPurchaseAsset(params);
                return {
                    status: 'success',
                    txDigest: result?.txHash || result?.digest || 'mcp_payment'
                };
            } catch (error) {
                console.error('[BeepMCP] MCP payment failed, falling back to REST:', error);
                // Fall through to REST API
            }
        }

        // REST API Fallback: Create invoice instead
        console.log('[BeepMCP] Using REST API (invoice creation) for payment');
        try {
            const invoice = await beepPaymentService.createInvoice({
                amount: params.amount,
                currency: params.currency,
                referenceKey: params.referenceId,
                description: `Payment via automated agent`
            });

            return {
                status: 'invoice_created',
                txDigest: invoice.id, // Use invoice ID as reference
                invoiceUrl: invoice.paymentUrl
            };
        } catch (error) {
            console.error('[BeepMCP] REST payment also failed:', error);
            throw error;
        }
    },

    async listTools() {
        if (beepMcpClient['sessionId']) {
            return beepMcpClient.listTools();
        }
        return []; // No tools if MCP not available
    }
};

// Standalone functions for backward compatibility
export async function createInvoice(params: {
    amount: number;
    currency?: string;
    referenceKey: string;
    description?: string;
    generateQrCode?: boolean;
}): Promise<{
    id: string;
    referenceKey: string;
    paymentUrl: string;
    qrCode?: string;
}> {
    const result = await beepPaymentService.createInvoice({
        ...params,
        referenceKey: params.referenceKey
    });
    
    // Ensure referenceKey is returned (Beep SDK may use referenceId or referenceKey)
    return {
        id: result.id,
        referenceKey: result.referenceKey || result.referenceId || params.referenceKey,
        paymentUrl: result.paymentUrl,
        qrCode: result.qrCode
    };
}

export async function getInvoice(invoiceId: string) {
    // Use BeepClient SDK instead of REST API (more reliable)
    const { beepSDKService } = await import('./beep-sdk.js');
    const result = await beepSDKService.getPaymentStatus(invoiceId);
    
    // Convert to expected format
    return {
        id: invoiceId,
        status: result.status || (result.paid ? 'paid' : 'pending'),
        paid: result.paid
    };
}
