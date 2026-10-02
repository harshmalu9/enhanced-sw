# Enhanced SW

An enhanced expense-sharing application with AI/ML capabilities for intelligent bill splitting, automated expense categorization, budget tracking, debt simplification, and spending insights.

## Architecture

```text
React Native / Expo (:8081)
        ↓ HTTP REST
Node.js / Express Backend (:3001)
   ├── PostgreSQL (:5432) [with in-memory fallback]
   └── HTTP REST Proxy
        ↓
Python / FastAPI AI Service (:8000)
```

### Core Components

1. **Frontend (`frontend/`)**: React Native / Expo mobile-first interface (Web, Android, iOS) with OCR receipt uploading, natural language consumption instructions, split breakdowns, spending insights, budget tracking, and debt settlement.
2. **Backend (`backend/`)**: Node.js & Express TypeScript core business layer. Manages database transactions, persistence, budget calculation, and proxies AI operations to the AI service.
3. **AI Service (`ai-service/`)**: Python FastAPI microservice providing local PaddleOCR receipt parsing, multi-provider LLM fallback routing (Gemini, Mistral, Groq), natural-language item assignment, deterministic penny-reconciled bill splitting, and time-series forecasting.
4. **Database**: PostgreSQL for persistent expense and budget storage, with automatic in-memory fallback for zero-configuration local development.

---

## Quick Start

Start all services with a single command:

```bash
./start.sh
```

This command:
1. Validates virtual environments, dependencies, and port availability (8000, 3001, 8081).
2. Checks PostgreSQL status.
3. Starts the Python AI service in the background and waits for `:8000/health`.
4. Starts the Node.js backend in the background and waits for `:3001/api/health`.
5. Launches Expo in the foreground with interactive QR code and keyboard shortcuts (`w` for web, `a` for Android, `r` to reload).
6. Gracefully terminates all background services upon `Ctrl+C`.

---

## Directory Structure

```text
enhanced-sw/
├── ai-service/         # Python FastAPI microservice (Port 8000)
│   ├── app.py          # FastAPI application & endpoints
│   ├── services/       # OCR, LLM router, splitter, categorizer, insights
│   ├── requirements.txt
│   └── .env.example
├── backend/            # Express TypeScript application backend (Port 3001)
│   ├── src/
│   │   ├── app.ts      # Express route definitions & middleware
│   │   ├── server.ts   # Server initialization & lifecycle
│   │   ├── db/         # PostgreSQL client, migrations, seed data
│   │   └── services/   # Business logic & repositories
│   ├── package.json
│   └── .env
├── frontend/           # Expo React Native mobile & web app (Port 8081)
│   ├── App.tsx         # Main interactive application coordinator
│   ├── components/     # UI screens, forms, receipts, charts
│   ├── services/api.ts # API client to backend proxy
│   ├── package.json
│   └── .env
├── docs/               # Architecture & design documentation
├── start.sh            # Unified development startup script
└── README.md
```

---

## Manual Service Execution

If running services individually:

### 1. Python AI Service
```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```
Health Check: `GET http://localhost:8000/health`

### 2. Node Backend
```bash
cd backend
npm install
npm run dev
```
Health Check: `GET http://localhost:3001/api/health`

### 3. Frontend
```bash
cd frontend
npm install
npm start
```

---

## Testing

Run all test suites across services:

```bash
# Python AI Service tests
cd ai-service && .venv/bin/pytest -v

# Backend tests
cd backend && npm test

# Frontend type check
cd frontend && npm run typecheck
```
