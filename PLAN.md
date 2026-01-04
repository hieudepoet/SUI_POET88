### 🛠 Prerequisites

Before starting, ensure you have:

1. **Node.js** (v18+) & **PostgreSQL** installed locally.
2. **Beep CLI**: `npm install -g @beep-it/cli`
3. **Sui Binaries**: Installed for smart contract compilation.
4. **Slush Wallet**: Set to **Sui Testnet** with some Testnet SUI and USDC.

---

### Cycle 1: Database & Agent Foundations (✅ Skeleton Done)

**Goal:** Setup the local environment and the "Freelancer" AI identity.

#### 1.1: Local Database Setup (Raw SQL) (✅ Done)

- [x] Create initialization script (`backend/scripts/init.sql`).
- [ ] **Action**: Run the script to create tables in your local PostgreSQL.

#### 1.2: Scaffold the Freelancer Agent (MCP) (✅ Done)

- [x] Create Agent Service structure.
- [x] Define tools (`execute_freelance_task`, `code_generation`, etc.).
- [ ] **Next Step**: Implement the actual logic in `agent-service/src/tools/*.ts` (currently stubs).

---

### Cycle 2: SUI Smart Contract (Escrow Layer) (✅ Code Done)

**Goal:** Create an on-chain Escrow to hold funds until the work is approved.

#### 2.1: Write the Move Contract (✅ Done)

- [x] Define `LockedPayment` struct.
- [x] Implement `create_escrow`, `release_escrow`, `cancel_escrow`.
- [x] Write Unit Tests.

#### 2.2: Deployment (🚧 NEXT STEP)

- [ ] **Action**: Run `sui client publish --gas-budget 100000000` from `move/beeplancer` directory.
- [ ] **Step**: Save the **Package ID** to `backend/.env` (variable `SUI_PACKAGE_ID`).

---

### Cycle 3: Backend Implementation (Orchestrator) (🚧 IN PROGRESS)

**Goal:** Connect your Backend to SUI, DB, and Beep Pay.

#### 3.1: Database Implementation

- [ ] **File**: `backend/src/db/database.ts` & `queries.ts`
- [ ] **Task**: Implement actual `pg` pool connection and query functions to replace stubs.

#### 3.2: SUI Service Implementation

- [ ] **File**: `backend/src/services/sui.ts`
- [ ] **Task**: Implement `createEscrow` function using `@mysten/sui`.
  - Needs `SUI_PACKAGE_ID` from Cycle 2.2.
  - Needs a backend wallet (with private key in `.env`) to sign transactions or act as a facilitator.

#### 3.3: Beep Pay Integration

- [ ] **File**: `backend/src/services/beep.ts`
- [ ] **Task**: Implement `createInvoice` and `createPayout` using real `@beep-it/sdk-core`.
- [ ] **File**: `backend/src/services/payment-poller.ts`
- [ ] **Task**: Implement polling logic to check Invoice status and trigger Escrow creation.

---

### Cycle 4: Frontend Integration (🚧 IN PROGRESS)

**Goal:** Build the UI for Buyers to hire Agents.

#### 4.1: UI Components (✅ Skeleton Done)

- [x] Setup Next.js with Tailwind CSS v4.
- [x] Create Header, Footer, Home Page.

#### 4.2: Wallet Connection

- [ ] **Task**: Configure `@mysten/dapp-kit` in `frontend/src/app/providers.tsx`.
- [ ] **Task**: Implement `WalletButton` to allow users to connect SUI wallets.

#### 4.3: API Integration

- [ ] **Task**: Connect Frontend to Backend API (`/api/jobs`, `/api/agents`).
- [ ] **Task**: Implement "Hire" flow:
  1. User clicks "Hire".
  2. Frontend calls Backend -> Backend creates Beep Invoice.
  3. Frontend displays Payment QR.
  4. User pays -> Backend polls -> Escrow created.

---

### Cycle 5: Agentic Execution & Testing

**Goal:** Ensure the system is "AI-discoverable" and bug-free.

#### 5.1: End-to-End Test

- [ ] **Buyer**: Use Slush Wallet (Testnet) to pay the Beep Invoice.
- [ ] **System**: Automatically detects payment -> Triggers Agent.
- [ ] **Agent**: Delivers "Code/Translation".
- [ ] **Buyer**: Clicks "Release" -> Agent receives USDC.

#### 5.2: AEO (Answer Engine Optimization)

- [ ] **Action**: Host a `llms.txt` file at the root of your domain.

---
