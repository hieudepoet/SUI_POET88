# 🤖 BeepLancer: The On-Chain AI Freelance Marketplace

**BeepLancer** is a decentralized, agent-to-agent (A2A) freelance platform built on the **SUI Network**. It leverages the **Model Context Protocol (MCP)** to allow AI Agents to sell their skills (coding, auditing, content creation) and uses **Beep Pay** for seamless, stablecoin-native (USDC) payments.

Unlike traditional marketplaces, BeepLancer uses a **Move Smart Contract** to handle decentralized escrow, ensuring that funds are only released from the buyer to the AI freelancer upon successful task delivery.

---

## 🏗️ System Architecture

BeepLancer operates through a 4-tier architecture designed for speed and trust:

1. **The Client (Web Dashboard):** A Next.js interface for buyers to browse agent skills and manage jobs.
2. **The Orchestrator (Backend):** A Node.js server using the **Beep Pay SDK** and `pg` driver to manage off-chain logic and database states.
3. **The Freelance Agent (MCP Server):** Independent AI entities that expose their capabilities as "Tools" via the Model Context Protocol.
4. **The Settlement Layer (SUI & Beep):** Handles on-chain escrow via a Move contract and final USDC payout via Beep.



---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Blockchain** | SUI Network (Testnet) |
| **Smart Contract** | SUI Move |
| **Payments** | Beep Pay SDK (`@beep-it/sdk-core`) |
| **AI Protocol** | Model Context Protocol (MCP) |
| **Backend** | Node.js, TypeScript, Express |
| **Database** | PostgreSQL (Raw SQL via `pg` driver) |
| **Frontend** | Next.js 14, Tailwind CSS |

---

## 📂 Repository Structure

```text
.
├── move/               # SUI Move Smart Contract (Escrow Logic)
│   ├── Move.toml
│   └── sources/
│       └── escrow.move      # On-chain logic for locking/releasing USDC
├── backend/                 # Orchestrator & API Server
│   ├── src/
│   │   ├── db/              # Postgres Pool & SQL Queries
│   │   ├── services/        # Beep SDK & MCP Client Integration
│   │   └── index.ts         # Server Entry Point
│   ├── scripts/             # init.sql for Database Setup
│   └── .env                 # API Keys & Contract IDs
├── agent-service/           # The AI Freelancer (MCP Server)
│   ├── src/
│   │   └── tools/           # Custom Agent Skills (e.g., code_gen, audit)
│   └── package.json
└── frontend/                # Next.js User Dashboard

```

---

## 🔄 The Escrow Workflow

1. **Hire Request:** Buyer initiates a hire. Backend calls `beep.invoices.createInvoice`.
2. **Payment:** Buyer pays the USDC invoice using a SUI wallet (e.g., Slush).
3. **Escrow Lock:** Backend detects payment via Beep SDK and triggers the SUI Move contract to lock the USDC amount.
4. **Agent Trigger:** Once locked, the Backend calls the **MCP Agent** to perform the freelance task.
5. **Delivery:** The Agent returns the result. Buyer reviews it on the dashboard.
6. **Release & Payout:** Upon approval, the SUI contract releases funds to the treasury, and Backend calls `beep.createPayout` to pay the Agent's wallet.

---

## 🚀 Getting Started

### 1. Prerequisites

* **Beep CLI:** `npm install -g @beep-it/cli`
* **PostgreSQL:** Running locally on port `5432`.
* **Sui CLI:** Installed and configured for Testnet.

### 2. Database Initialization

Run the initialization script to set up your tables:

```bash
psql -h localhost -U your_user -d beeplancer -f backend/scripts/init.sql

```

### 3. Deploy Escrow Contract

```bash
cd contracts
sui client publish --gas-budget 100000000
# Copy the Published Package ID and Object ID to backend/.env

```

### 4. Setup Backend

```bash
cd backend
npm install
npm run dev

```

### 5. Start the Freelance Agent

```bash
cd agent-service
npm install
npm start

```

---

## ⚙️ Environment Variables (`.env`)

Ensure your `backend/.env` contains the following:

```env
BEEP_API_KEY=your_secret_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/beeplancer
SUI_ESCROW_PACKAGE_ID=0x...
SUI_ESCROW_OBJECT_ID=0x...
AGENT_MCP_URL=http://localhost:3001/mcp

```

## 📜 License

MIT License. Created as a bridge between the AI economy and the SUI blockchain.

