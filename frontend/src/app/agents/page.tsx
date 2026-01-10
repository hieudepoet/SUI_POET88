'use client';

import { useEffect, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import PaymentModal from '@/components/PaymentModal';

interface Agent {
  id: number;
  userId: number;
  walletAddress: string;
  skills: string[];
  hourlyRate: number;
  description: string;
  rating: number;
  jobsCompleted: number;
  isAvailable: boolean;
}

interface Job {
  id: number;
  title: string;
  description: string;
  amount_usdc: number;
}

export default function AgentsPage() {
  const currentAccount = useCurrentAccount();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [jobForPayment, setJobForPayment] = useState<Job | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/agents');
      const data = await res.json();
      if (!data.error) {
        setAgents(data.data.agents);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHireAgent = async (agent: Agent) => {
    if (!currentAccount) {
      alert('Please connect your wallet first!');
      return;
    }

    setSelectedAgent(agent);
  };

  const handleCreateJob = async (jobDetails: { title: string; description: string }) => {
    if (!selectedAgent || !currentAccount) return;

    try {
      // Mock user 
      const buyerId = 1;

      console.log('[AgentsPage] Creating job for agent:', selectedAgent.id);

      // Create job with selected agent
      const response = await fetch('http://localhost:3000/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jobDetails.title,
          description: jobDetails.description,
          requirements: `Skills: ${selectedAgent.skills.join(', ')}`,
          buyerId: buyerId,
          agentId: selectedAgent.userId,
          amountUsdc: Number(selectedAgent.hourlyRate).toFixed(2) // Format to 2 decimals
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AgentsPage] Job response:', data);
        const job = data.data.job;

        console.log('[AgentsPage] ✅ Job created:', job);
        
        // Open payment modal with real job from database
        setJobForPayment({
          id: job.id,
          title: job.title,
          description: job.description || job.requirements || '',
          amount_usdc: job.amountUsdc // Use amount from database, not local state
        });
        setSelectedAgent(null); // Close job creation modal
      } else {
        const errorData = await response.json();
        console.error('[AgentsPage] Job creation failed:', errorData);
        throw new Error(errorData.message || 'Failed to create job');
      }
    } catch (error: any) {
      console.error('[AgentsPage] Error creating job:', error);
      alert(`Failed to create job: ${error.message}`);
    }
  };

  const filteredAgents = agents.filter(agent => 
    filter === '' || agent.skills.some(skill => 
      skill.toLowerCase().includes(filter.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">AI Agents Marketplace</h1>
              <p className="text-lg text-slate-600">Discover autonomous agents ready to work</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="mt-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by skills (e.g., coding, design)..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-6 py-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 text-slate-900 placeholder-slate-400 transition-colors"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200">
                <div className="skeleton h-12 w-12 rounded-xl mb-4" />
                <div className="skeleton h-6 w-3/4 mb-2" />
                <div className="skeleton h-4 w-full mb-4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No agents found</h3>
            <p className="text-slate-600">Try adjusting your search filter</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
            {filteredAgents.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onHire={() => handleHireAgent(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Job Creation Modal */}
      {selectedAgent && (
        <JobCreationModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onCreate={handleCreateJob}
        />
      )}

      {/* Payment Modal */}
      {jobForPayment && (
        <PaymentModal
          job={jobForPayment}
          isOpen={!!jobForPayment}
          onClose={() => setJobForPayment(null)}
          onSuccess={() => {
            setJobForPayment(null);
            alert('✅ Payment successful! Job is now in escrow.');
          }}
        />
      )}
    </div>
  );
}

function AgentCard({ agent, onHire }: { agent: Agent; onHire: () => void }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 card-hover">
      {/* Avatar & Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white text-xl font-bold">
              🤖
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Agent #{agent.id}</h3>
              <div className="flex items-center space-x-1">
                <span className="text-yellow-500">⭐</span>
                <span className="text-sm font-semibold text-slate-700">{agent.rating}</span>
                <span className="text-sm text-slate-500">({agent.jobsCompleted} jobs)</span>
              </div>
            </div>
          </div>
          
          {agent.isAvailable ? (
            <div className="badge badge-success">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1" />
              Available
            </div>
          ) : (
            <div className="badge bg-slate-100 text-slate-600">Busy</div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-600 text-sm mb-4 line-clamp-2">
        {agent.description || 'AI agent ready for autonomous task execution'}
      </p>

      {/* Skills */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-500 mb-2">SKILLS</div>
        <div className="flex flex-wrap gap-2">
          {agent.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
              {skill}
            </span>
          ))}
          {agent.skills.length > 4 && (
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
              +{agent.skills.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Rate & CTA */}
      <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">${agent.hourlyRate}</div>
          <div className="text-xs text-slate-500">per task</div>
        </div>
        <button 
          onClick={onHire}
          className="btn btn-primary"
        >
          💳 Hire Agent
        </button>
      </div>

      {/* Wallet */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="address-display text-xs">
          {agent.walletAddress.slice(0, 8)}...{agent.walletAddress.slice(-6)}
        </div>
      </div>
    </div>
  );
}

function JobCreationModal({ 
  agent, 
  onClose, 
  onCreate 
}: { 
  agent: Agent; 
  onClose: () => void; 
  onCreate: (details: { title: string; description: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!title || !description) {
      alert('Please fill in all fields');
      return;
    }
    onCreate({ title, description });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Create Job for Agent #{agent.id}
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Job Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Build a React Landing Page"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Job Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you need the agent to do..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0"
            />
          </div>

          <div className="p-4 bg-indigo-50 rounded-xl">
            <p className="text-sm text-indigo-800">
              <strong>Amount:</strong> ${agent.hourlyRate} USDC
            </p>
            <p className="text-xs text-indigo-700 mt-1">
              Payment will be held in escrow until job completion
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-bold"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>
  );
}
