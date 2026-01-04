### 🛠 Prerequisites

Before starting, ensure you have:

1. **Node.js** (v18+) & **PostgreSQL** installed locally.
2. **Beep CLI**: `npm install -g @beep-it/cli`
3. **Sui Binaries**: Installed for smart contract compilation.
4. **Slush Wallet**: Set to **Sui Testnet** with some Testnet SUI and USDC.

---

### Cycle 1: Database & Agent Foundations

**Goal:** Setup the local environment and the "Freelancer" AI identity.

#### 1.1: Local Database Setup (Raw SQL)

Connect to your local Postgres and run the following script to initialize the marketplace schema.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('buyer', 'agent')) NOT NULL
);

CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    buyer_id INTEGER REFERENCES users(id),
    agent_id INTEGER REFERENCES users(id),
    amount_usdc DECIMAL(12, 6) NOT NULL,
    status TEXT DEFAULT 'unpaid', -- unpaid, escrowed, working, completed, paid_out
    beep_invoice_id TEXT,
    reference_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

#### 1.2: Scaffold the Freelancer Agent (MCP)

Use the Beep CLI to create the Agent that will perform the work.

* **Action**: `beep init-mcp --role mcp-server --mode https --path ./agent-service`
* **Step**: Open `agent-service/src/tools`, and define a tool named `execute_freelance_task`. This tool should simulate work and return a result string.

---

### Cycle 2: SUI Smart Contract (Escrow Layer)

**Goal:** Create an on-chain Escrow to hold funds until the work is approved. While Beep handles the payment, a Move contract adds decentralization.

#### 2.1: Write the Move Contract

Create a new Sui Move project: `sui move new escrow`.

* **Logic**: Create a `LockedPayment` object that stores the `amount` and the `agent_address`.
* **Function `create_escrow**`: Buyer sends USDC to the contract.
* **Function `release_escrow**`: Only the Buyer can call this to send the locked USDC to the Agent.

#### 2.2: Deployment

* **Action**: `sui client publish --gas-budget 100000000`
* **Step**: Save the **Package ID** and **Escrow Shared Object ID** to your backend `.env`.

---

### Cycle 3: Payment Integration (Beep SDK)

**Goal:** Connect your Backend to Beep Pay to handle the USDC flow.

#### 3.1: Backend Initialization

Install the SDK: `npm install @beep-it/sdk-core pg`.
Setup the `BeepClient`:

```typescript
import { BeepClient } from '@beep-it/sdk-core';
const beep = new BeepClient({ apiKey: process.env.BEEP_API_KEY });

```

#### 3.2: The "Hire" Flow (Invoice Creation)

When a buyer clicks "Hire":

1. **Generate Invoice**: Call `beep.invoices.createInvoice({ amount, token: 'USDC', ... })`.
2. **Save to DB**: Store the `invoice.id` and `invoice.referenceKey` in your `jobs` table.
3. **Return to Frontend**: Send the `paymentUrl` and `qrCode` to the user.

#### 3.3: Verification Polling

Implement a background worker or an endpoint to verify payment:

* **Logic**: Call `beep.invoices.getInvoice(invoiceId)`.
* **Action**: If status is `paid`, update the DB `jobs.status` to `escrowed`.

---

### Cycle 4: Agentic Execution & MCP Orchestration

**Goal:** Trigger the AI to work once the money is secured.

#### 4.1: Triggering the Agent

Once the job is `escrowed`:

* **Action**: Use an MCP Client to connect to your `agent-service` (from Cycle 1).
* **Command**: `mcpClient.callTool('execute_freelance_task', { specs: jobData })`.
* **Step**: Once the agent returns the result, update `jobs.status` to `completed` and store the result.

#### 4.2: Buyer Approval & Payout

The final step in the freelance cycle:

1. **Approval**: User reviews the work on the Frontend and clicks "Release Funds".
2. **Move Call**: Your backend triggers the `release_escrow` function on the SUI Smart Contract.
3. **Beep Payout**: Call `beep.createPayout({ amount, destinationWalletAddress: agentWallet, ... })` to move the funds from your platform treasury to the agent.

---

### Cycle 5: Testing & AEO Optimization

**Goal:** Ensure the system is "AI-discoverable" and bug-free.

#### 5.1: End-to-End Test (The Walkthrough)

1. **Buyer**: Use Slush Wallet (Testnet) to pay the Beep Invoice.
2. **System**: Automatically detects payment -> Triggers Agent.
3. **Agent**: Delivers "Code/Translation".
4. **Buyer**: Clicks "Release" -> Agent receives USDC.

#### 5.2: AEO (Answer Engine Optimization)

To make your marketplace discoverable by other AI Agents:

* **Action**: Host a `llms.txt` file at the root of your domain.
* **Content**: Define your marketplace API endpoints and the types of MCP Agents available for hire. This allows LLMs (like GPT or Claude) to "browse" your freelance market.

---
