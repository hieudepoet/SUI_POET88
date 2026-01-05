# BeepLancer Implementation Plan

> **Last Updated**: 2026-01-05
> 
> **Current Phase**: Foundation Complete (Skeletons Ready)
> 
> **Next Phase**: Backend Core Implementation

---

## 🎯 Project Vision

Build an **autonomous agent-to-agent economy** where AI agents can:
1. Offer skills to users
2. **Scout and hire** other agents
3. **Auto-pay** from allocated pools
4. **Verify work** and release escrow automatically

---

## 📋 Prerequisites

Before starting implementation, ensure you have:

1. **Node.js** (v18+) & **PostgreSQL** installed locally
2. **Beep CLI**: `npm install -g @beep-it/cli`
3. **Sui Binaries**: Installed for smart contract compilation
4. **Slush Wallet** or equivalent: Set to **Sui Testnet** with some Testnet SUI and USDC

---

## 🏗️ Implementation Roadmap

### ✅ Phase 0: Project Skeleton (COMPLETED)

All foundational structure is in place:

#### Database & Schema ✅
- [x] `backend/scripts/init.sql` - Complete schema with tables, indexes, views
- [x] Users, Agents, Jobs, Deliveries tables defined
- [x] **ACTION**: Run `init.sql` on local PostgreSQL

#### Smart Contract ✅
- [x] Move contract with `LockedPayment` struct
- [x] Functions: `create_escrow`, `release_escrow`, `cancel_escrow`
- [x] Unit tests (skeleton)
- [x] Admin emergency recovery
- [x] **ACTION**: Build & publish to Testnet

#### Backend Structure ✅
- [x] Express server setup (`src/index.ts`)
- [x] Database layer skeleton (`src/db/`)
- [x] Services skeleton:
  - `beep.ts` - Beep Pay integration
  - `sui.ts` - SUI blockchain
  - `mcp-client.ts` - Agent communication
  - `payment-poller.ts` - Background polling
- [x] Routes skeleton:
  - `users.ts`, `agents.ts`, `jobs.ts`, `payments.ts`

#### Agent Service ✅
- [x] MCP Server structure (`src/mcp-server.ts`)
- [x] **11 Tools** registered:
  - **Beep Tools** (6): checkBeepApi, issuePayment, requestAndPurchaseAsset, streaming
  - **Agent Tools** (5): scoutAgents, hireAgent, signSuiTransaction, submitDelivery, verifyDelivery
- [x] Type definitions
- [x] README with usage examples

#### Frontend Structure ✅
- [x] Next.js 14 setup
- [x] Tailwind CSS v4 configured
- [x] Layout, Header, Footer components
- [x] Home page skeleton
- [x] Providers setup (React Query)

---

### 🚧 Phase 1: Foundation Layer (IN PROGRESS)

**Goal**: Get core infrastructure running

#### 1.1: Database Initialization ⚠️ NEXT
**Priority**: CRITICAL

**Files**: `backend/scripts/init.sql`

**Tasks**:
- [x] Create PostgreSQL database `beeplancer`
- [x] Run `psql -d beeplancer -f backend/scripts/init.sql`
- [x] Verify tables created:
  ```sql
  \dt  -- List tables
  SELECT * FROM platform_config;
  ```
- [x] Test views: `v_active_jobs`, `v_agent_stats`

**Estimated Time**: 30 minutes

---

#### 1.2: Smart Contract Deployment ⚠️ NEXT
**Priority**: CRITICAL

**Files**: `move/beeplancer/`

**Tasks**:
- [x] Build contract: `sui move build`
- [x] Test: `sui move test` (ensure all tests pass)
- [x] Publish to Testnet:
  ```bash
  sui client publish --gas-budget 100000000
  ```
- [x] Save **Package ID** to `backend/.env`:
  ```env
  SUI_PACKAGE_ID=0x...
  ```
- [x] Test escrow creation manually via CLI (optional)

**Estimated Time**: 1-2 hours

**Blockers**: Need testnet SUI for gas fees

---

### 🔧 Phase 2: Backend Core Implementation

**Goal**: Working API that can handle jobs and payments

#### 2.1: Database Layer Implementation
**Priority**: HIGH

**Files**: 
- `backend/src/db/database.ts`
- `backend/src/db/queries.ts`

**Tasks**:
```typescript
// database.ts
- [x] Implement `initializeDatabase()` - Create pg pool
- [x] Implement `query()` - Execute SQL
- [x] Implement `transaction()` - Atomic operations
- [x] Add connection health check

// queries.ts  
- [x] Implement user CRUD functions
- [x] Implement agent CRUD functions
- [x] Implement job CRUD functions
- [x] Implement delivery queries
```

**Test**:
```typescript
// After implementation, test in index.ts:
const user = await createUser({ wallet: '0x...', role: 'buyer' });
console.log('Created user:', user);
```

**Estimated Time**: 3-4 hours

---

#### 2.2: SUI Service Implementation
**Priority**: HIGH

**Files**: `backend/src/services/sui.ts`

**Dependencies**:
- Smart contract deployed (Phase 1.2)
- `SUI_PACKAGE_ID` in `.env`

**Tasks**:
```typescript
- [ ] Install @mysten/sui: `npm install @mysten/sui`
- [ ] Implement `initializeSuiClient()` - Connect to testnet
- [ ] Implement `createEscrow()`:
  - Build transaction with moveCall
  - Sign with platform keypair
  - Execute and return object ID
- [ ] Implement `releaseEscrow()`:
  - Call release_escrow function
  - Return transaction digest
- [ ] Implement `getEscrowState()` - Query on-chain data
- [ ] Add error handling for insufficient gas
```

**Test**:
```typescript
const result = await createEscrow({
  usdcCoinId: '0x...',
  agentAddress: '0x...',
  jobReference: 'TEST-001',
  amount: 1000000, // 1 USDC (6 decimals)
});
console.log('Escrow created:', result.escrowObjectId);
```

**Estimated Time**: 4-5 hours

---

#### 2.3: Beep Pay Integration
**Priority**: HIGH

**Files**: `backend/src/services/beep.ts`

**Tasks**:
```typescript
- [ ] Implement `initializeBeepClient()` - Initialize SDK
- [ ] Implement `createInvoice()`:
  - Call beep.invoices.createInvoice()
  - Return invoice with paymentUrl, qrCode
- [ ] Implement `getInvoiceStatus()` - Check payment status
- [ ] Implement `createPayout()` - Pay agent wallet
- [ ] Add webhook signature verification helpers
```

**Test**:
```typescript
const invoice = await createInvoice({
  amount: 50,
  referenceKey: 'JOB-001',
  description: 'Payment for coding task',
});
console.log('Invoice URL:', invoice.paymentUrl);
```

**Estimated Time**: 3-4 hours

---

#### 2.4: Payment Poller Service
**Priority**: MEDIUM

**Files**: `backend/src/services/payment-poller.ts`

**Dependencies**:
- Database layer (2.1)
- Beep service (2.3)
- SUI service (2.2)

**Tasks**:
```typescript
- [ ] Implement `pollPayments()` - Main polling loop
- [ ] Implement `processPayment()`:
  - Check invoice status via Beep
  - If paid: create escrow on SUI
  - Update job status to 'escrowed'
  - Trigger agent via MCP (optional for now)
- [ ] Add proper error handling
- [ ] Implement exponential backoff for retries
```

**Estimated Time**: 2-3 hours

---

#### 2.5: API Routes Implementation
**Priority**: MEDIUM

**Files**: `backend/src/routes/*.ts`

**Implementation Order**:

**2.5.1: Users Routes** (`users.ts`)
```typescript
- [ ] POST /auth - Wallet authentication (verify signature)
- [ ] GET /profile - Get user profile
- [ ] PUT /profile - Update profile
```

**2.5.2: Agents Routes** (`agents.ts`)
```typescript
- [ ] GET /agents - List all agents (with filters)
- [ ] GET /agents/:id - Get agent details
- [ ] POST /agents - Register new agent
- [ ] PUT /agents/:id - Update agent profile
```

**2.5.3: Jobs Routes** (`jobs.ts`)
```typescript
- [ ] POST /jobs - Create new job
- [ ] GET /jobs - List jobs (filter by user/agent/status)
- [ ] GET /jobs/:id - Get job details
- [ ] POST /jobs/:id/hire - Create invoice for job
- [ ] POST /jobs/:id/approve - Approve delivery & release escrow
- [ ] POST /jobs/:id/delivery - Submit delivery
```

**2.5.4: Payments Routes** (`payments.ts`)
```typescript
- [ ] POST /webhooks/beep - Handle Beep payment webhooks
- [ ] GET /invoices/:id - Get invoice status
```

**Estimated Time**: 5-6 hours total

---

### 🤖 Phase 3: Agent Service Implementation

**Goal**: Agents can scout, hire, and pay autonomously

#### 3.1: SUI Transaction Signing
**Priority**: HIGH

**Files**: `agent-service/src/tools/signSuiTransaction.ts`

**Tasks**:
```typescript
- [ ] Install @mysten/sui in agent-service
- [ ] Load agent keypair from AGENT_PRIVATE_KEY env
- [ ] Implement transaction building for:
  - 'transfer' - Simple USDC/SUI transfer
  - 'create_escrow' - Lock funds for sub-job
  - 'release_escrow' - Pay sub-agent
- [ ] Sign and execute transactions
- [ ] Return transaction digest
```

**Estimated Time**: 3-4 hours

---

#### 3.2: Scout & Hire Implementation
**Priority**: MEDIUM

**Files**:
- `agent-service/src/tools/scoutAgents.ts`
- `agent-service/src/tools/hireAgent.ts`

**Tasks**:
```typescript
// scoutAgents.ts
- [ ] Implement HTTP GET to Backend /api/v1/agents
- [ ] Parse query params (skills, budget, rating)
- [ ] Return formatted agent list

// hireAgent.ts
- [ ] Implement HTTP POST to Backend /api/v1/jobs
- [ ] If autoPayFromPool:
  - Get invoice ID from response
  - Call issuePayment tool to pay
- [ ] Return job details with escrow info
```

**Estimated Time**: 3-4 hours

---

#### 3.3: Delivery Management
**Priority**: MEDIUM

**Files**:
- `agent-service/src/tools/submitDelivery.ts`
- `agent-service/src/tools/verifyDelivery.ts`

**Tasks**:
```typescript
// submitDelivery.ts
- [ ] Implement HTTP POST to Backend /api/v1/jobs/:id/delivery
- [ ] Handle large content (external URL for files)
- [ ] Return delivery ID

// verifyDelivery.ts
- [ ] Implement HTTP GET to fetch delivery content
- [ ] Optional: Add LLM quality analysis
- [ ] If approved && autoRelease:
  - Call signSuiTransaction('release_escrow')
  - Notify backend of release
```

**Estimated Time**: 3-4 hours

---

### 🎨 Phase 4: Frontend Implementation

**Goal**: User-friendly UI for hiring agents

#### 4.1: Wallet Connection
**Priority**: HIGH

**Files**: `frontend/src/app/providers.tsx`, `frontend/src/components/wallet/WalletButton.tsx`

**Tasks**:
```typescript
- [ ] Uncomment SuiClientProvider in providers.tsx
- [ ] Configure wallet adapter
- [ ] Implement WalletButton component
- [ ] Show connected address
- [ ] Handle disconnect
```

**Estimated Time**: 2-3 hours

---

#### 4.2: Core Pages
**Priority**: MEDIUM

**Implementation Order**:

**4.2.1: Agents Page** (`app/agents/page.tsx`)
```typescript
- [ ] Fetch agents from Backend API
- [ ] Display in grid with AgentCard
- [ ] Add skill filters
- [ ] Add sorting (rating, price)
```

**4.2.2: Agent Detail** (`app/agents/[id]/page.tsx`)
```typescript
- [ ] Fetch agent details
- [ ] Show skills, rating, portfolio
- [ ] "Hire Agent" button
- [ ] Job creation form
```

**4.2.3: Dashboard** (`app/dashboard/page.tsx`)
```typescript
- [ ] List user's jobs
- [ ] Filter by status
- [ ] Show deliveries
- [ ] Approve/reject actions
```

**Estimated Time**: 6-8 hours total

---

#### 4.3: Payment Flow UI
**Priority**: MEDIUM

**Files**: `frontend/src/components/payment/PaymentModal.tsx`

**Tasks**:
```typescript
- [ ] Display Beep QR code
- [ ] Show payment URL
- [ ] Poll payment status every 5s
- [ ] Show success animation
- [ ] Handle payment timeout
```

**Estimated Time**: 2-3 hours

---

### 🧪 Phase 5: Testing & Optimization

#### 5.1: End-to-End Testing
**Priority**: HIGH

**Test Scenarios**:

**Scenario 1: User → Agent (Basic)**
```
1. User registers via wallet
2. User creates job
3. User pays Beep invoice
4. Backend creates escrow
5. Agent submits delivery
6. User approves
7. Escrow releases to agent
```

**Scenario 2: Agent → Agent (Autonomous)**
```
1. User hires Agent A
2. Agent A scouts for Agent B
3. Agent A hires Agent B (auto-pay from pool)
4. Agent B delivers
5. Agent A verifies & releases
6. Agent A delivers to User
7. User approves final delivery
```

**Estimated Time**: 4-6 hours

---

#### 5.2: Production Readiness

**Tasks**:
- [ ] Add rate limiting to API
- [ ] Implement request logging
- [ ] Add error monitoring (Sentry?)
- [ ] Optimize database queries
- [ ] Add caching layer (Redis?)
- [ ] Security audit of escrow contract
- [ ] Load testing

**Estimated Time**: 8-10 hours

---

## 📊 Time Estimates Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Foundation | Database + Contract Deploy | 2-3 hours |
| 2. Backend | DB + SUI + Beep + Poller + Routes | 18-22 hours |
| 3. Agent Service | SUI Signing + Scout/Hire + Delivery | 9-12 hours |
| 4. Frontend | Wallet + Pages + Payment UI | 10-14 hours |
| 5. Testing | E2E + Production Prep | 12-16 hours |
| **TOTAL** | | **51-67 hours** |

---

## ⚠️ Implementation Notes

### When Implementing Any Module:

1. **ALWAYS read this PLAN.md first** to understand context
2. **Check README.md** for architecture overview
3. **Follow the priority order** to avoid dependency issues
4. **Update this file** when completing tasks (mark with [x])
5. **Test immediately** after implementing each module

### Common Pitfalls to Avoid:

- ❌ Don't implement Frontend before Backend APIs exist
- ❌ Don't implement Agent tools without Backend endpoints
- ❌ Don't skip database layer - everything depends on it
- ❌ Don't hardcode secrets - use environment variables
- ❌ Don't forget to update `.env.example` when adding new vars

### Key Dependencies:

```
Smart Contract → SUI Service → Backend Routes → Frontend
     ↓              ↓
Database ← → Beep Service → Payment Poller
     ↓
Backend APIs → Agent Tools (scout/hire)
```

---

## 🔗 Quick Links

- [Main README](./README.md)
- [Agent Service README](./agent-service/README.md)
- [Smart Contract](./move/beeplancer/sources/escrow.move)
- [Database Schema](./backend/scripts/init.sql)

---

**Next Action**: Start with Phase 1.1 (Database Initialization) or 1.2 (Contract Deployment)
