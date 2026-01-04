/**
 * =============================================================================
 * BeepLancer Agent Service - Main Entry Point
 * =============================================================================
 * 
 * This is an MCP Server that exposes the AI Agent's capabilities as "tools"
 * that can be called by the BeepLancer backend orchestrator.
 * 
 * The agent can:
 * - Generate code based on specifications
 * - Audit code for security/performance issues
 * - Translate content
 * - Create content (documentation, articles, etc.)
 * 
 * MCP TRANSPORT MODES:
 * - HTTP: Agent runs as an HTTP server (recommended for production)
 * - STDIO: Agent communicates via standard input/output (for local testing)
 * 
 * =============================================================================
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { HttpServerTransport } from '@modelcontextprotocol/sdk/server/http.js';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ErrorCode,
    McpError
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import tool handlers
import { executeFreelanceTask, getToolDefinition as getFreelanceToolDef } from './tools/freelance-task.js';
import { generateCode, getToolDefinition as getCodeGenToolDef } from './tools/code-generation.js';
import { auditCode, getToolDefinition as getAuditToolDef } from './tools/code-audit.js';
import { translateContent, getToolDefinition as getTranslateToolDef } from './tools/translation.js';

dotenv.config();

// =============================================================================
// CONSTANTS
// =============================================================================

const AGENT_NAME = process.env.AGENT_NAME || 'BeepLancer AI Freelancer';
const AGENT_VERSION = '1.0.0';

// =============================================================================
// SERVER SETUP
// =============================================================================

/**
 * Create and configure the MCP Server
 * 
 * IMPLEMENTATION:
 * 1. Create Server instance with agent info
 * 2. Register tool handlers
 * 3. Set up error handling
 */
function createServer(): Server {
    const server = new Server(
        {
            name: AGENT_NAME,
            version: AGENT_VERSION,
        },
        {
            capabilities: {
                tools: {},
                // Add other capabilities as needed
                // resources: {},
                // prompts: {},
            },
        }
    );

    // ==========================================================================
    // TOOL LISTING HANDLER
    // ==========================================================================

    /**
     * Handle tools/list request
     * Returns all available tools (skills) this agent offers
     */
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        // Collect all tool definitions
        const tools = [
            getFreelanceToolDef(),
            getCodeGenToolDef(),
            getAuditToolDef(),
            getTranslateToolDef(),
        ];

        // Filter based on enabled skills
        // const enabledTools = tools.filter(tool => {
        //     if (tool.name === 'code_generation' && !process.env.ENABLE_CODE_GENERATION) return false;
        //     if (tool.name === 'code_audit' && !process.env.ENABLE_CODE_AUDIT) return false;
        //     if (tool.name === 'translation' && !process.env.ENABLE_TRANSLATION) return false;
        //     return true;
        // });

        return { tools };
    });

    // ==========================================================================
    // TOOL EXECUTION HANDLER
    // ==========================================================================

    /**
     * Handle tools/call request
     * Execute the requested tool and return the result
     */
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            console.log(`[Agent] Executing tool: ${name}`);
            console.log(`[Agent] Arguments:`, JSON.stringify(args, null, 2));

            let result: string;

            // Route to appropriate handler
            // TODO: Implement actual tool routing
            switch (name) {
                case 'execute_freelance_task':
                    result = await executeFreelanceTask(args as any);
                    break;

                case 'code_generation':
                    result = await generateCode(args as any);
                    break;

                case 'code_audit':
                    result = await auditCode(args as any);
                    break;

                case 'translation':
                    result = await translateContent(args as any);
                    break;

                default:
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Unknown tool: ${name}`
                    );
            }

            console.log(`[Agent] Tool ${name} completed`);

            return {
                content: [
                    {
                        type: 'text',
                        text: result,
                    },
                ],
            };

        } catch (error) {
            console.error(`[Agent] Tool ${name} failed:`, error);

            if (error instanceof McpError) {
                throw error;
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                    },
                ],
                isError: true,
            };
        }
    });

    return server;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
    console.log('='.repeat(60));
    console.log(`🤖 ${AGENT_NAME} v${AGENT_VERSION}`);
    console.log('='.repeat(60));

    const server = createServer();
    const mode = process.env.MCP_TRANSPORT_MODE || 'stdio';

    if (mode === 'stdio') {
        // STDIO transport - for local testing
        console.log('[Agent] Starting in STDIO mode...');

        const transport = new StdioServerTransport();
        await server.connect(transport);

        console.log('[Agent] Connected via STDIO');

    } else if (mode === 'http') {
        // HTTP transport - for production
        console.log('[Agent] Starting in HTTP mode...');

        // TODO: Implement HTTP transport
        // The MCP SDK may have HttpServerTransport or you may need to implement it
        // using Express + SSE (Server-Sent Events) as per MCP spec

        // const port = parseInt(process.env.PORT || '3001');
        // const transport = new HttpServerTransport({ port });
        // await server.connect(transport);

        // For now, use a simple HTTP wrapper
        await startHttpServer(server);

    } else {
        console.error(`[Agent] Unknown transport mode: ${mode}`);
        process.exit(1);
    }
}

/**
 * Start HTTP server wrapper for MCP
 * 
 * This is a simplified HTTP interface that wraps the MCP server
 * In production, you might want to use proper MCP HTTP transport
 * 
 * TODO: Implement proper MCP HTTP transport
 */
async function startHttpServer(server: Server): Promise<void> {
    // const express = (await import('express')).default;
    // const app = express();
    // const port = parseInt(process.env.PORT || '3001');

    // app.use(express.json());

    // // Health check
    // app.get('/health', (req, res) => {
    //     res.json({ status: 'ok', agent: AGENT_NAME });
    // });

    // // MCP endpoint
    // app.post('/mcp', async (req, res) => {
    //     // Handle MCP JSON-RPC requests
    //     // This is simplified - proper implementation would use SSE
    //     try {
    //         const response = await server.handleRequest(req.body);
    //         res.json(response);
    //     } catch (error) {
    //         res.status(500).json({ error: 'Internal error' });
    //     }
    // });

    // app.listen(port, () => {
    //     console.log(`[Agent] HTTP server listening on http://localhost:${port}`);
    //     console.log(`[Agent] MCP endpoint: http://localhost:${port}/mcp`);
    // });

    console.log('[Agent] HTTP mode - TODO: Implement proper HTTP transport');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Agent] Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('[Agent] Received SIGTERM, shutting down...');
    process.exit(0);
});

// Start the agent
main().catch((error) => {
    console.error('[Agent] Fatal error:', error);
    process.exit(1);
});
