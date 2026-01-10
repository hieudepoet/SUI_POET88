'use client';

import { useState } from 'react';
import { useBeepPayment } from '@/hooks/useBeepPayment';

interface PaymentModalProps {
    job: {
        id: number;
        title: string;
        description: string;
        amount_usdc: number;
    };
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PaymentModal({ job, isOpen, onClose, onSuccess }: PaymentModalProps) {
    const [paymentUrl, setPaymentUrl] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const {
        createInvoice,
        waitForPayment,
        isCreatingInvoice,
        isWaitingPayment
    } = useBeepPayment();

    const handleStartPayment = async () => {
        setIsProcessing(true);
        setError('');

        try {
            // Step 1: Create invoice
            console.log('[PaymentModal] Creating invoice...');
            
            const invoice = await createInvoice(job);
            
            setPaymentUrl(invoice.paymentUrl);
            setQrCode(invoice.qrCode);

            // Step 2: Wait for payment (polling by jobId)
            console.log('[PaymentModal] Waiting for payment...');
            console.log('[PaymentModal] Open this URL to pay:', invoice.paymentUrl);
            
            const paid = await waitForPayment(job.id);

            if (paid) {
                // Success! PaymentPoller will automatically:
                // - Detect the payment
                // - Create escrow on SUI
                // - Update job status to 'escrowed'
                console.log('[PaymentModal] ✅ Payment successful!');
                console.log('[PaymentModal] Backend will automatically create escrow');
                
                alert('✅ Payment successful!\n\nPaymentPoller is creating escrow on SUI blockchain...\nJob will be ready for work soon!');
                onSuccess();
                onClose();
            } else {
                setError('Payment timeout - please try again');
            }

        } catch (err: any) {
            console.error('[PaymentModal] Payment error:', err);
            setError(err.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        Payment Required
                    </h2>
                    <p className="text-slate-600 text-sm">
                        Scan QR code with Beep/Slush Wallet to pay
                    </p>
                </div>

                {/* Job Details */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                    <div className="mb-3">
                        <p className="text-xs text-slate-500 uppercase font-bold">Job</p>
                        <p className="text-slate-900 font-medium">{job.title}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Amount</p>
                        <p className="text-2xl font-bold text-indigo-600">${job.amount_usdc} USDC</p>
                    </div>
                </div>

                {/* QR Code and Payment URL */}
                {(paymentUrl || qrCode) && (
                    <div className="mb-6 flex flex-col items-center">
                        {qrCode && (
                            <div className="mb-4 p-4 bg-white border-2 border-slate-200 rounded-xl">
                                <img src={qrCode} alt="Payment QR Code" className="w-48 h-48" />
                            </div>
                        )}
                        
                        <div className="w-full p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                            <p className="text-xs font-bold text-indigo-800 mb-2">PAYMENT LINK</p>
                            <a 
                                href={paymentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:underline break-all block"
                            >
                                Click to Pay (Mobile)
                            </a>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* Status */}
                {isProcessing && (
                    <div className="mb-4 text-center">
                        {isCreatingInvoice && (
                            <p className="text-sm text-slate-600">Creating invoice...</p>
                        )}
                        {isWaitingPayment && (
                            <div>
                                <div className="animate-spin inline-block w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
                                <p className="text-sm text-slate-600">Waiting for payment confirmation...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex space-x-3">
                    {!paymentUrl ? (
                        <>
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStartPayment}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                            >
                                Pay with USDC
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                            disabled={isProcessing}
                        >
                            Close
                        </button>
                    )}
                </div>

                {/* Payment Status */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                        <strong>💳 Real Payment:</strong> This uses actual Beep SDK with USDC on SUI chain. 
                        Once paid, escrow will be created automatically on SUI blockchain.
                    </p>
                </div>
            </div>
        </div>
    );
}
