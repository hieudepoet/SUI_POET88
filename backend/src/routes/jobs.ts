/**
 * =============================================================================
 * Jobs Routes - API Endpoints for Job Management
 * =============================================================================
 * 
 * Endpoints:
 * - POST   /api/v1/jobs              - Create new job
 * - GET    /api/v1/jobs              - List jobs (with filters)
 * - GET    /api/v1/jobs/:id          - Get job details
 * - POST   /api/v1/jobs/:id/hire     - Create invoice for hiring
 * - POST   /api/v1/jobs/:id/delivery - Submit job delivery
 * - POST   /api/v1/jobs/:id/approve  - Approve delivery & release escrow
 * - POST   /api/v1/jobs/:id/cancel   - Cancel job
 * 
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import * as queries from '../db/queries.js';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface CreateJobBody {
    title: string;
    requirements?: string;
    buyerId: number;
    agentId?: number;
    amountUsdc: number;
}

interface HireBody {
    generateQrCode?: boolean;
}

interface DeliveryBody {
    content: string;
    deliveryType?: 'code' | 'document' | 'link' | 'text';
    externalUrl?: string;
    notes?: string;
}

interface ApproveBody {
    approved: boolean;
    feedback?: string;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/v1/jobs
 * Create a new job
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { title, requirements, buyerId, agentId, amountUsdc } = 
            req.body as CreateJobBody;

        // Validate required fields
        if (!title || !buyerId || !amountUsdc) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'title, buyerId, and amountUsdc are required',
            });
        }

        // Validate amount
        if (amountUsdc <= 0) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'amountUsdc must be greater than 0',
            });
        }

        // Create job
        const job = await queries.createJob(
            title,
            buyerId,
            amountUsdc,
            requirements,
            agentId
        );

        res.status(201).json({
            status: 201,
            error: false,
            message: 'Job created successfully',
            data: {
                job: {
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    buyerId: job.buyer_id,
                    agentId: job.agent_id,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    referenceKey: job.reference_key,
                    createdAt: job.created_at,
                },
            },
        });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to create job',
        });
    }
});

/**
 * GET /api/v1/jobs
 * List jobs with optional filters
 * 
 * Query params:
 * - buyerId: Filter by buyer
 * - agentId: Filter by agent
 * - status: Filter by status
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { buyerId, agentId, status } = req.query;

        let jobs;

        if (buyerId) {
            jobs = await queries.getJobsByBuyer(
                parseInt(buyerId as string),
                status as any
            );
        } else if (agentId) {
            jobs = await queries.getJobsByAgent(
                parseInt(agentId as string),
                status as any
            );
        } else {
            // TODO: Implement getAllJobs query
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Please provide buyerId or agentId filter',
            });
        }

        res.json({
            status: 200,
            error: false,
            message: `Found ${jobs.length} jobs`,
            data: {
                jobs: jobs.map(job => ({
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    buyerId: job.buyer_id,
                    agentId: job.agent_id,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    referenceKey: job.reference_key,
                    escrowObjectId: job.escrow_object_id,
                    createdAt: job.created_at,
                    deliveredAt: job.delivered_at,
                })),
                count: jobs.length,
            },
        });
    } catch (error) {
        console.error('Error listing jobs:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to list jobs',
        });
    }
});

/**
 * GET /api/v1/jobs/:id
 * Get job details
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        // TODO: Get related data (buyer, agent, deliveries)
        // const buyer = await queries.getUserById(job.buyer_id);
        // const agent = job.agent_id ? await queries.getUserById(job.agent_id) : null;
        // const deliveries = await queries.getDeliveriesByJob(jobId);

        res.json({
            status: 200,
            error: false,
            message: 'Job details retrieved successfully',
            data: {
                job: {
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    buyerId: job.buyer_id,
                    agentId: job.agent_id,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    referenceKey: job.reference_key,
                    beepInvoiceId: job.beep_invoice_id,
                    escrowObjectId: job.escrow_object_id,
                    escrowTxDigest: job.escrow_tx_digest,
                    releaseTxDigest: job.release_tx_digest,
                    createdAt: job.created_at,
                    paidAt: job.paid_at,
                    startedAt: job.started_at,
                    deliveredAt: job.delivered_at,
                    completedAt: job.completed_at,
                    paidOutAt: job.paid_out_at,
                },
                // buyer,
                // agent,
                // deliveries,
            },
        });
    } catch (error) {
        console.error('Error getting job details:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get job details',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/hire
 * Create Beep invoice for job payment
 * 
 * Body:
 * - generateQrCode: boolean (optional, default: true)
 */
router.post('/:id/hire', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { generateQrCode = true } = req.body as HireBody;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        if (job.status !== 'unpaid') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot hire - job status is ${job.status}`,
            });
        }

        // TODO: Create Beep invoice
        // import { createInvoice } from '../services/beep.js';
        // 
        // const invoice = await createInvoice({
        //     amount: job.amount_usdc,
        //     referenceKey: job.reference_key,
        //     description: `Payment for job: ${job.title}`,
        //     generateQrCode,
        // });
        //
        // // Update job with invoice ID
        // await queries.updateJobStatus(jobId, 'unpaid', {
        //     beep_invoice_id: invoice.id,
        // });

        res.json({
            status: 200,
            error: false,
            message: 'Invoice created (TODO: implement Beep service)',
            data: {
                invoice: {
                    // id: invoice.id,
                    // paymentUrl: invoice.paymentUrl,
                    // qrCode: invoice.qrCode,
                    amount: job.amount_usdc,
                    referenceKey: job.reference_key,
                },
            },
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to create invoice',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/delivery
 * Submit job delivery (agent only)
 * 
 * Body:
 * - content: string (the actual work result)
 * - deliveryType: 'code' | 'document' | 'link' | 'text'
 * - externalUrl: string (optional, for large files)
 * - notes: string (optional)
 */
router.post('/:id/delivery', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { content, deliveryType = 'text', externalUrl, notes } = 
            req.body as DeliveryBody;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        if (!content) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'content is required',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        if (job.status !== 'working' && job.status !== 'escrowed') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot submit delivery - job status is ${job.status}`,
            });
        }

        // TODO: Save delivery to job_deliveries table
        // const delivery = await queries.createDelivery({
        //     job_id: jobId,
        //     content,
        //     delivery_type: deliveryType,
        //     external_url: externalUrl,
        //     notes,
        // });

        // Update job status to 'delivered'
        await queries.updateJobStatus(jobId, 'delivered');

        res.json({
            status: 200,
            error: false,
            message: 'Delivery submitted successfully (TODO: implement createDelivery)',
            data: {
                jobId,
                delivery: {
                    // id: delivery.id,
                    content: content.substring(0, 100) + '...', // Preview
                    deliveryType,
                    externalUrl,
                    notes,
                    submittedAt: new Date().toISOString(),
                },
            },
        });
    } catch (error) {
        console.error('Error submitting delivery:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to submit delivery',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/approve
 * Approve delivery and release escrow (buyer only)
 * 
 * Body:
 * - approved: boolean
 * - feedback: string (optional)
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { approved, feedback } = req.body as ApproveBody;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        if (typeof approved !== 'boolean') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'approved (boolean) is required',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        if (job.status !== 'delivered') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot approve - job must be 'delivered', current: ${job.status}`,
            });
        }

        if (approved) {
            // TODO: Release escrow on SUI blockchain
            // import { releaseEscrow } from '../services/sui.js';
            // 
            // const txDigest = await releaseEscrow({
            //     escrowObjectId: job.escrow_object_id!,
            // });

            // Update job status to 'completed'
            await queries.updateJobStatus(jobId, 'completed', {
                // release_tx_digest: txDigest,
            });

            // TODO: Trigger payout via Beep
            // import { createPayout } from '../services/beep.js';
            // await createPayout({
            //     amount: job.amount_usdc,
            //     recipientAddress: agentWallet,
            // });

            res.json({
                status: 200,
                error: false,
                message: 'Delivery approved, escrow release initiated (TODO: implement SUI service)',
                data: {
                    jobId,
                    status: 'completed',
                    feedback,
                },
            });
        } else {
            // Rejected - request revision
            await queries.updateJobStatus(jobId, 'working');

            res.json({
                status: 200,
                error: false,
                message: 'Delivery rejected, requesting revision',
                data: {
                    jobId,
                    status: 'working',
                    feedback,
                },
            });
        }
    } catch (error) {
        console.error('Error approving delivery:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to approve delivery',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/cancel
 * Cancel job and refund buyer
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        // Only allow cancellation if not yet paid out
        if (job.status === 'paid_out' || job.status === 'completed') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot cancel - job is already ${job.status}`,
            });
        }

        // TODO: Cancel escrow if exists
        // if (job.escrow_object_id) {
        //     import { cancelEscrow } from '../services/sui.js';
        //     await cancelEscrow({
        //         escrowObjectId: job.escrow_object_id,
        //     });
        // }

        await queries.updateJobStatus(jobId, 'cancelled');

        res.json({
            status: 200,
            error: false,
            message: 'Job cancelled successfully (TODO: implement cancelEscrow if needed)',
            data: {
                jobId,
                status: 'cancelled',
            },
        });
    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to cancel job',
        });
    }
});

export default router;
