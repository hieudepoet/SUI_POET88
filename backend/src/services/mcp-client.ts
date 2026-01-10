/**
 * =============================================================================
 * MCP Client Service - AI Agent Communication
 * =============================================================================
 * 
 * This module handles communication with the Freelance AI Agent via MCP
 * (Model Context Protocol). It acts as the bridge between the backend
 * orchestrator and the AI agent that performs the actual work.
 * 
 * MCP OVERVIEW:
 * - The agent exposes "tools" (skills) that can be called
 * - Each tool has defined input/output schemas
 * - Communication happens over HTTP(S) or stdio
 * 
 * =============================================================================
 */

// TODO: Import MCP client library
// import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// import { StdioClientTransport, HttpClientTransport } from '@modelcontextprotocol/sdk/client/transports.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Task specification sent to the agent
 */
export interface FreelanceTaskSpec {
    /** Unique job ID from database */
    jobId: number;
    /** Title of the job */
    title: string;
    /** Detailed requirements */
    requirements: string;
    /** Type of work: 'code_generation', 'code_audit', 'translation', etc. */
    taskType: string;
    /** Any additional context or files */
    context?: {
        language?: string;
        framework?: string;
        existingCode?: string;
        references?: string[];
    };
    /** Maximum time allowed for task (in minutes) */
    timeout?: number;
}

/**
 * Result returned by the agent
 */
export interface FreelanceTaskResult {
    /** Whether the task completed successfully */
    success: boolean;
    /** The actual output/deliverable */
    content: string;
    /** Type of content: 'code', 'text', 'json', 'url' */
    contentType: 'code' | 'text' | 'json' | 'url';
    /** Optional: Additional metadata */
    metadata?: {
        language?: string;
        linesOfCode?: number;
        filesCreated?: string[];
        executionTime?: number;
    };
    /** Error message if success is false */
    error?: string;
}

/**
 * Agent tool definition
 */
export interface AgentTool {
    name: string;
    description: string;
    inputSchema: object;
}

// =============================================================================
// CLIENT INSTANCE
// =============================================================================

interface McpConfig {
    agentUrl: string;
    timeout: number;
}

let mcpConfig: McpConfig | null = null;
let isConnected = false;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize MCP client and connect to the agent server
 * 
 * Uses HTTP transport to communicate with agent-service
 */
export async function initializeMcpClient(): Promise<void> {
    const agentUrl = process.env.MCP_AGENT_URL || process.env.AGENT_MCP_URL;

    if (!agentUrl) {
        throw new Error('MCP_AGENT_URL environment variable is required');
    }

    mcpConfig = {
        agentUrl,
        timeout: 300000 // 5 minutes default timeout
    };

    // Test connection
    try {
        const response = await fetch(`${agentUrl}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Agent health check failed: ${response.statusText}`);
        }

        isConnected = true;
        console.log(`[MCP] Connected to agent at ${agentUrl}`);
    } catch (error) {
        console.error('[MCP] Failed to connect to agent:', error);
        throw new Error(`MCP initialization failed: ${error}`);
    }
}

/**
 * Check if MCP client is connected to the agent
 */
export function isMcpConnected(): boolean {
    return isConnected;
}

/**
 * Disconnect from the agent
 */
export async function disconnectMcpClient(): Promise<void> {
    if (isConnected) {
        isConnected = false;
        mcpConfig = null;
        console.log('[MCP] Client disconnected');
    }
}

// =============================================================================
// TOOL OPERATIONS
// =============================================================================

/**
 * List available tools (skills) from the agent
 */
export async function listAgentTools(): Promise<AgentTool[]> {
    if (!mcpConfig || !isConnected) {
        throw new Error('MCP client not connected');
    }

    try {
        const response = await fetch(`${mcpConfig.agentUrl}/tools`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to list tools: ${response.statusText}`);
        }

        const data: any = await response.json();
        return data.tools || [];

    } catch (error) {
        console.error('[MCP] Error listing agent tools:', error);
        throw error;
    }
}

/**
 * Execute a freelance task by calling the agent's tool
 * 
 * This is the main function called when a job moves to 'working' status
 */
export async function executeFreelanceTask(
    taskSpec: FreelanceTaskSpec
): Promise<FreelanceTaskResult> {
    if (!mcpConfig || !isConnected) {
        return {
            success: false,
            content: '',
            contentType: 'text',
            error: 'MCP client not connected. Call initializeMcpClient() first.'
        };
    }

    console.log(`[MCP] Executing task for job ${taskSpec.jobId}: ${taskSpec.taskType}`);

    try {
        // Call agent-service HTTP endpoint
        const response = await fetch(`${mcpConfig.agentUrl}/execute-task`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobId: taskSpec.jobId,
                title: taskSpec.title,
                requirements: taskSpec.requirements,
                taskType: taskSpec.taskType,
                context: taskSpec.context || {},
                timeout: taskSpec.timeout || 300 // 5 minutes default
            }),
            signal: AbortSignal.timeout(mcpConfig.timeout)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Agent returned error ${response.status}: ${errorText}`);
        }

        const result: any = await response.json();

        // Parse agent response
        if (result.success === false || result.error) {
            return {
                success: false,
                content: result.content || '',
                contentType: 'text',
                error: result.error || 'Task execution failed'
            };
        }

        console.log(`[MCP] Task completed successfully for job ${taskSpec.jobId}`);

        return {
            success: true,
            content: result.content || result.output || '',
            contentType: detectContentType(result.content || result.output || ''),
            metadata: {
                executionTime: result.executionTime,
                language: result.language,
                linesOfCode: result.linesOfCode,
                filesCreated: result.filesCreated
            }
        };

    } catch (error) {
        console.error(`[MCP] Error executing task for job ${taskSpec.jobId}:`, error);

        if (error instanceof TypeError && error.message.includes('fetch')) {
            return {
                success: false,
                content: '',
                contentType: 'text',
                error: 'Failed to connect to agent service. Is it running?'
            };
        }

        if (error instanceof Error && error.name === 'TimeoutError') {
            return {
                success: false,
                content: '',
                contentType: 'text',
                error: `Task timed out after ${mcpConfig.timeout / 1000} seconds`
            };
        }

        return {
            success: false,
            content: '',
            contentType: 'text',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Request code generation from the agent
 * Convenience wrapper for executeFreelanceTask with 'code_generation' type
 * 
 * @param jobId - Job ID
 * @param requirements - What code to generate
 * @param context - Additional context (language, framework, etc.)
 * @returns Generated code result
 */
export async function requestCodeGeneration(
    jobId: number,
    requirements: string,
    context?: FreelanceTaskSpec['context']
): Promise<FreelanceTaskResult> {
    return executeFreelanceTask({
        jobId,
        title: 'Code Generation Request',
        requirements,
        taskType: 'code_generation',
        context
    });
}

/**
 * Request code audit from the agent
 * 
 * @param jobId - Job ID
 * @param code - Code to audit
 * @param auditType - Type of audit: 'security', 'performance', 'style'
 * @returns Audit result
 */
export async function requestCodeAudit(
    jobId: number,
    code: string,
    auditType: 'security' | 'performance' | 'style' = 'security'
): Promise<FreelanceTaskResult> {
    return executeFreelanceTask({
        jobId,
        title: `${auditType.charAt(0).toUpperCase() + auditType.slice(1)} Audit`,
        requirements: `Perform a ${auditType} audit on the provided code`,
        taskType: 'code_audit',
        context: {
            existingCode: code
        }
    });
}

/**
 * Request translation from the agent
 * 
 * @param jobId - Job ID
 * @param text - Text to translate
 * @param targetLanguage - Target language
 * @returns Translation result
 */
export async function requestTranslation(
    jobId: number,
    text: string,
    targetLanguage: string
): Promise<FreelanceTaskResult> {
    return executeFreelanceTask({
        jobId,
        title: `Translation to ${targetLanguage}`,
        requirements: text,
        taskType: 'translation',
        context: {
            language: targetLanguage
        }
    });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Detect content type from the result string
 * 
 * @param content - Content to analyze
 * @returns Detected content type
 */
function detectContentType(content: string): FreelanceTaskResult['contentType'] {
    // URL detection
    if (content.startsWith('http://') || content.startsWith('https://')) {
        return 'url';
    }

    // JSON detection
    try {
        JSON.parse(content);
        return 'json';
    } catch {
        // Not JSON
    }

    // Code detection (simple heuristic)
    const codePatterns = [
        /^(import|export|const|let|var|function|class|def|pub fn|module)/m,
        /[{};]/,
        /=>/,
    ];

    if (codePatterns.some(pattern => pattern.test(content))) {
        return 'code';
    }

    return 'text';
}

/**
 * Health check for MCP connection
 */
export async function checkAgentHealth(): Promise<boolean> {
    if (!mcpConfig || !isConnected) {
        return false;
    }

    try {
        const response = await fetch(`${mcpConfig.agentUrl}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        return response.ok;
    } catch {
        return false;
    }
}
