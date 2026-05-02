<img width="1774" height="887" alt="salamdesk-headline" src="https://github.com/user-attachments/assets/038b3cc0-d3ac-416b-98ff-8c0b017dacd0" />

# 🕊️ SalamDesk

**SalamDesk** is an AI-powered, multichannel helpdesk system specifically engineered for healthcare environments (e.g., RSUD Karawang). It streamlines hospital operations by integrating WhatsApp messaging with automated AI triage, SLA management, and a robust Knowledge Base.

---

## 🛠️ Technical Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Runtime:** [Bun](https://bun.sh/)
- **Database:** PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [Better-Auth](https://www.better-auth.com/)
- **Background Jobs:** [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/)
- **AI Integration:** [Vercel AI SDK](https://sdk.vercel.ai/) via [OpenRouter](https://openrouter.ai/)
- **WhatsApp Integration:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) (WebSocket)
- **UI Components:** Shadcn UI, Radix UI, Tailwind CSS
- **Query State:** [nuqs](https://nuqs.47ng.com/)

---

## 🏗️ Architecture & Data Flow

SalamDesk operates using a decoupled architecture. The **Next.js Web App** serves as the agent/admin interface, while a standalone **Worker Process** handles real-time WhatsApp connections and background processing.

### 📥 Inbound Message & Triage Flow
```mermaid
sequenceDiagram
    participant C as Customer (WhatsApp)
    participant W as Worker (Baileys)
    participant Q as BullMQ (Redis)
    participant D as Database (Postgres)
    participant AI as AI Service (LLM)

    C->>W: Sends Message
    W->>Q: Enqueue 'wa-inbound' job
    Q->>W: Process job
    W->>D: Find/Create Reporter & Ticket
    W->>D: Store Message
    W->>Q: Enqueue 'ai-triage' job
    Q->>W: Process triage
    W->>AI: Classify Module, Priority, & KB Search
    AI-->>W: Triage Results
    W->>D: Update Ticket & Store Suggestion
    alt High Confidence
        W->>C: Auto-reply via WhatsApp
    end
```

### 📤 Agent Outbound Flow
```mermaid
sequenceDiagram
    participant A as Agent (Web UI)
    participant SA as Server Action
    participant Q as BullMQ (Redis)
    participant W as Worker (Baileys)
    participant C as Customer (WhatsApp)

    A->>SA: Send Reply
    SA->>Q: Enqueue 'wa-outbound' job
    Q->>W: Process job
    W->>C: Send Message via WhatsApp
```

---

## 📊 Database Schema (ERD)

```mermaid
erDiagram
    USERS ||--o{ TICKETS : "creates/assigned_to"
    USERS ||--o{ TICKET_MESSAGES : "sends"
    MODULES ||--o{ TICKETS : "categorizes"
    MODULES ||--o{ SLA_CONFIGS : "defines"
    MODULES ||--o{ KNOWLEDGE_BASE : "contains"
    TICKETS ||--|{ TICKET_MESSAGES : "has"
    TICKETS ||--o{ AI_SUGGESTIONS : "receives"
    KNOWLEDGE_BASE ||--o{ AI_SUGGESTIONS : "suggested_for"

    TICKETS {
        string id PK
        string title
        string status "open, resolved, etc"
        string priority "low, medium, critical"
        uuid module_id FK
        timestamp sla_deadline_at
        string wa_phone
    }

    TICKET_MESSAGES {
        uuid id PK
        string ticket_id FK
        string sender_id FK
        string sender_type "user, agent, ai_bot"
        text content
        boolean is_internal_note
    }

    SLA_CONFIGS {
        uuid id PK
        uuid module_id FK
        string priority
        int response_time_minutes
        int resolution_time_minutes
    }
```

---

## ✨ Key Features

- **Multichannel Ticketing:** Primarily focused on WhatsApp integration via real-time WebSockets.
- **AI Triage:** Automatic classification of hospital modules (SIMRS), priority assessment, and KB article matching.
- **SLA Management:** Dynamic SLA deadlines based on module-specific configurations and ticket priority.
- **Knowledge Base:** Centralized documentation for agents with AI-suggested resolutions.
- **Quick Replies:** Template-based responses for common issues.
- **Internal Collaboration:** Internal notes and ticket escalation between agents.

---

## 🚀 Getting Started

### 1. Requirements
- Bun installed
- Redis instance running
- PostgreSQL (Supabase) instance

### 2. Installation
```bash
bun install
```

### 3. Environment Setup
Create a `.env` file based on `.env.example`:
```env
DATABASE_URL=...
REDIS_URL=...
OPENROUTER_API_KEY=...
```

### 4. Running the Application
You need to run **two separate processes**:

**Web Application (Next.js):**
```bash
bun dev
```

**Background Worker & WhatsApp Socket:**
```bash
bun worker
```

---

## 📁 Project Structure

- `src/app`: Next.js pages and routes.
- `src/actions`: Server Actions for business logic.
- `src/services`: Shared business logic and external integrations.
- `src/worker`: BullMQ worker implementations and WhatsApp bot logic.
- `src/db/schema`: Drizzle ORM table definitions.
- `src/lib`: Utility functions and shared clients (Redis, DB, etc).
