'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect, useState } from 'react';
import PaymentModal from '@/components/PaymentModal';

interface Job {
  id: number;
  title: string;
  description: string;
  requirements: string;
  amount_usdc: number;
  status: string;
  buyer_id: number;
  agent_id: number | null;
  created_at: string;
}

export default function JobsPage() {
  const currentAccount = useCurrentAccount();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Fetch jobs
  useEffect(() => {
    if (!currentAccount) return;
    fetchJobs();
  }, [currentAccount]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/v1/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHireAgent = (job: Job) => {
    setSelectedJob(job);
  };

  const handlePaymentSuccess = () => {
    // Refresh jobs after payment
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Jobs Marketplace</h1>
          <p className="text-lg text-slate-600">Browse and hire agents for your jobs</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!currentAccount ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Connect Your Wallet</h3>
            <p className="text-slate-600">Please connect your wallet to view and manage jobs</p>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <div className="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <p className="text-slate-600">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-6xl mb-4">💼</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No Jobs Yet</h3>
            <p className="text-slate-600 mb-6">
              Go to the chat to create your first job with AI assistance!
            </p>
            <a 
              href="/chat" 
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold"
            >
              Go to Chat
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div 
                key={job.id} 
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
              >
                {/* Job Title */}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{job.title}</h3>
                
                {/* Description */}
                <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                  {job.description || job.requirements}
                </p>

                {/* Amount */}
                <div className="mb-4 p-3 bg-indigo-50 rounded-xl">
                  <p className="text-xs text-indigo-700 font-bold uppercase mb-1">Budget</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    ${job.amount_usdc} USDC
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`
                    px-3 py-1 rounded-full text-xs font-bold
                    ${job.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${job.status === 'escrowed' ? 'bg-blue-100 text-blue-800' : ''}
                    ${job.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                  `}>
                    {job.status.toUpperCase()}
                  </span>
                </div>

                {/* Action Button */}
                {job.status === 'pending' && !job.agent_id ? (
                  <button
                    onClick={() => handleHireAgent(job)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold"
                  >
                    💳 Hire Agent
                  </button>
                ) : job.status === 'escrowed' ? (
                  <div className="text-center py-3 bg-blue-50 rounded-xl">
                    <p className="text-sm font-bold text-blue-700">🔒 Escrow Active</p>
                  </div>
                ) : job.status === 'completed' ? (
                  <div className="text-center py-3 bg-green-50 rounded-xl">
                    <p className="text-sm font-bold text-green-700">✅ Completed</p>
                  </div>
                ) : (
                  <div className="text-center py-3 bg-slate-50 rounded-xl">
                    <p className="text-sm font-bold text-slate-700">In Progress...</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <p>Created: {new Date(job.created_at).toLocaleDateString()}</p>
                  <p>ID: #{job.id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedJob && (
        <PaymentModal
          job={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
