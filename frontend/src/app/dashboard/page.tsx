'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  walletAddress: string;
  displayName: string;
  role: string;
}

interface AgentWallet {
  userId: number;
  agentWalletAddress: string;
}

export default function DashboardPage() {
  const currentAccount = useCurrentAccount();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentAccount) {
      router.push('/');
      return;
    }
    fetchUserData();
  }, [currentAccount]);

  const fetchUserData = async () => {
    if (!currentAccount) return;

    try {
      // Get user profile
      const userRes = await fetch('http://localhost:3000/api/v1/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: currentAccount.address }),
      });
      const userData = await userRes.json();
      
      if (!userData.error) {
        setUser(userData.data.user);

        // Get agent wallet
        const walletRes = await fetch('http://localhost:3000/api/v1/users/agent-wallet', {
          headers: { 'x-wallet-address': currentAccount.address },
        });
        const walletData = await walletRes.json();
        
        if (!walletData.error) {
          setAgentWallet(walletData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-6xl mb-4">🤖</div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-slate-600">Failed to load user data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">My Dashboard</h1>
          <p className="text-lg text-slate-600">Welcome back, {user.displayName || 'User'}!</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Profile Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">User ID</label>
                  <div className="mt-1 text-lg font-mono text-slate-900">#{user.id}</div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Wallet Address</label>
                  <div className="mt-1 address-display">
                    {user.walletAddress}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Role</label>
                  <div className="mt-1">
                    <span className="badge badge-primary text-sm py-1.5">
                      {user.role.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Display Name</label>
                  <div className="mt-1 text-lg text-slate-900">{user.displayName || 'Not set'}</div>
                </div>
              </div>
            </div>

            {/* Agent Wallet Card */}
            {agentWallet && (
              <div className="mt-6 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm">
                    🤖
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Your Personal Agent Wallet</h3>
                    <p className="text-indigo-100 text-sm">Deterministically generated from your User ID</p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <div className="text-xs font-semibold text-indigo-100 mb-2 uppercase tracking-wide">Agent Address</div>
                  <div className="font-mono text-sm break-all">{agentWallet.agentWalletAddress}</div>
                </div>

                <div className="mt-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <p className="text-sm text-indigo-100">
                    ℹ️ This wallet is managed by the backend for autonomous agent operations. 
                    Same user ID always generates the same wallet address.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Quick Stats</h3>
              
              <div className="space-y-4">
                <StatItem label="Active Jobs" value="0" icon="💼" />
                <StatItem label="Completed Jobs" value="0" icon="✅" />
                <StatItem label="Total Spent" value="$0" icon="💰" />
                <StatItem label="Pool Balance" value="$0" icon="🏦" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button className="w-full btn btn-primary justify-start">
                  <span>📝</span>
                  <span>Create New Request</span>
                </button>
                <button className="w-full btn btn-secondary justify-start">
                  <span>🔍</span>
                  <span>Browse Agents</span>
                </button>
                <button className="w-full btn btn-secondary justify-start">
                  <span>💼</span>
                  <span>View My Jobs</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">Recent Activity</h3>
          
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-slate-600">No activity yet. Create your first job to get started!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="text-2xl">{icon}</div>
        <div className="text-sm text-slate-600">{label}</div>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
