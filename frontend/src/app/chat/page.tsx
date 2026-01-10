'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PaymentModal from '@/components/PaymentModal';

interface ChatMessage {
  id: number;
  message: string;
  description: string;
  status: 'pending' | 'processed' | 'failed';
  createdAt: string;
  updated_at: string;
  jobId?: number;
  job_id?: number; // DB returns snake_case
  response?: string;
  job_title?: string;
  amount_usdc?: number;
  job_status?: string;
  error_message?: string;
  agent_name?: string;
  agent_rating?: string;
}

export default function ChatPage() {
  const currentAccount = useCurrentAccount();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ChatMessage[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  useEffect(() => {
    if (!currentAccount) {
      router.push('/');
      return;
    }
    fetchUser();
  }, [currentAccount]);

  useEffect(() => {
    if (user?.id) {
      fetchRequests();
      const interval = setInterval(fetchRequests, 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUser = async () => {
    if (!currentAccount) return;

    try {
      const res = await fetch('http://localhost:3000/api/v1/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: currentAccount.address }),
      });
      const data = await res.json();
      if (!data.error) {
        setUser(data.data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchRequests = async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`http://localhost:3000/api/v1/chat/requests/${user.id}`);
      const data = await res.json();
      if (!data.error) {
        setRequests(data.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user?.id) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/chat/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!data.error) {
        setMessage('');
        await fetchRequests();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-6xl mb-4">🤖</div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-xl flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AI Personal Agent</h1>
              <p className="text-slate-600">Tell me what you need, and I'll find the right agent for you</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="space-y-4 mb-6">
          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Start Your First Request</h3>
              <p className="text-slate-600">Type a message below to get started with your AI assistant</p>
            </div>
          ) : (
            requests.slice().reverse().map((req) => (
              <div key={req.id} className="space-y-3">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-indigo-600 text-white rounded-2xl px-4 py-3 max-w-xl shadow-sm">
                    <p>{req.description}</p>
                    <p className="text-xs text-indigo-200 mt-1">
                      {new Date(req.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Agent Response */}
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-xl shadow-sm">
                    {req.status === 'pending' && (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin text-indigo-500">⏳</div>
                        <p className="text-slate-600">Analyzing request & searching for agents...</p>
                      </div>
                    )}
                    
                    {req.status === 'processed' && req.job_title && (
                      <div>
                        <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-100">
                          <span className="text-xl">✅</span>
                          <div>
                            <p className="font-bold text-slate-900">Task Auto-Processed!</p>
                            <p className="text-xs text-slate-500">AI orchestration complete</p>
                          </div>
                        </div>
                        
                        <p className="text-slate-700 mb-3">
                          I've assigned this task to <strong>{req.agent_name || 'Agent'}</strong> {req.agent_rating && `(⭐ ${req.agent_rating})`} 
                          who matched your requirements perfectly.
                        </p>

                        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-2 border border-slate-100">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Job:</span>
                            <span className="font-medium text-slate-900">{req.job_title}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Budget:</span>
                            <span className="font-medium text-slate-900">${req.amount_usdc} USDC</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Status:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              req.job_status === 'completed' ? 'bg-green-100 text-green-700' :
                              req.job_status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                              (req.job_status === 'unpaid' || req.job_status === 'pending') ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {req.job_status?.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* HIRE BUTTON */}
                        {(req.job_status === 'unpaid' || req.job_status === 'pending') && (
                          <button
                            onClick={() => setSelectedJob({ 
                                id: req.job_id || req.jobId, 
                                title: req.job_title, 
                                description: req.description,
                                amount_usdc: req.amount_usdc 
                            })}
                            className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold flex items-center justify-center space-x-2"
                          >
                            <span>💳</span>
                            <span>Hire Agent (${req.amount_usdc})</span>
                          </button>
                        )}

                        {(req.job_status === 'delivered' || req.job_status === 'completed') && (
                          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <p className="text-xs font-bold text-indigo-800 mb-1">🚀 DELIVERY RECEIVED</p>
                            <p className="text-sm text-indigo-700">
                              Work has been delivered successfully! Payment was released from escrow.
                            </p>
                            <div className="mt-2 text-xs py-1 px-2 bg-white rounded border border-indigo-100">
                              <a href="#" className="underline text-indigo-500">View Deployment</a> • <a href="#" className="underline text-indigo-500">View Source Code</a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {req.status === 'failed' && (
                      <div>
                        <div className="flex items-center space-x-2 mb-2 text-red-600">
                          <span>❌</span>
                          <p className="font-bold">Process Failed</p>
                        </div>
                        <p className="text-slate-600 text-sm">{req.error_message || 'Something went wrong'}</p>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 mt-2 text-right">
                      {new Date(req.updated_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={sendMessage} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-200">
          <div className="flex space-x-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what you need... (e.g., 'Build me a landing page')"
              className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 text-slate-900 placeholder-slate-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="btn btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Sending...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <span>Send</span>
                  <span>→</span>
                </span>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 The AI will automatically find and hire the best agent for your task
          </p>
        </form>

        {/* Payment Modal */}
        {selectedJob && (
          <PaymentModal
            job={selectedJob}
            isOpen={!!selectedJob}
            onClose={() => setSelectedJob(null)}
            onSuccess={() => {
                fetchRequests(); // Refresh status
                setSelectedJob(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
