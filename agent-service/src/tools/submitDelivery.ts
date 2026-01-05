/**
 * =============================================================================
 * Submit Delivery Tool - Nộp kết quả công việc
 * =============================================================================
 * 
 * Tool cho phép Sub-Agent nộp kết quả sau khi hoàn thành job.
 * Kết quả được lưu vào Backend database (job_deliveries table).
 * 
 * TODO: Implement delivery submission to Backend API
 * =============================================================================
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MCPToolDefinition, MCPResponse, MCPErrorResponse } from '../types/index.js';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const submitDeliverySchema = z.object({
  jobId: z.number().describe('ID of the job to submit delivery for'),
  content: z.string().describe('The actual work result (code, text, etc.)'),
  deliveryType: z.enum(['code', 'document', 'link', 'text']).default('text').describe('Type of delivery'),
  externalUrl: z.string().optional().describe('URL to external storage if content is too large'),
  notes: z.string().optional().describe('Additional notes for the buyer'),
});

export type SubmitDeliveryParams = z.infer<typeof submitDeliverySchema>;

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Submit job delivery to Backend
 * 
 * IMPLEMENTATION STEPS:
 * 1. Validate job exists and is in 'working' status
 * 2. POST delivery to Backend API
 * 3. Backend updates job status to 'delivered'
 * 4. Return confirmation with delivery ID
 * 
 * TODO: Implement actual API call
 */
export async function submitDelivery(
  params: SubmitDeliveryParams
): Promise<MCPResponse | MCPErrorResponse> {
  try {
    const { jobId, content, deliveryType, externalUrl, notes } = params;

    // TODO: Submit to Backend API
    // const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    // const response = await fetch(`${backendUrl}/api/v1/jobs/${jobId}/delivery`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     content,
    //     deliveryType,
    //     externalUrl,
    //     notes,
    //   }),
    // });
    // const result = await response.json();

    // Placeholder response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deliveryId: 1, // Mock ID
            jobId,
            status: 'submitted',
            deliveredAt: new Date().toISOString(),
            message: 'TODO: Implement actual delivery submission to Backend',
            nextSteps: [
              'Backend saves delivery to job_deliveries table',
              'Backend updates job status to "delivered"',
              'Buyer is notified to review the work',
              'Buyer can approve (release escrow) or request revision',
            ],
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Failed to submit delivery: ${errorMessage}` };
  }
}

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const submitDeliveryTool: MCPToolDefinition = {
  name: 'submitDelivery',
  description: 'Submit completed work for a job',
  inputSchema: zodToJsonSchema(submitDeliverySchema),
  handler: submitDelivery,
};
