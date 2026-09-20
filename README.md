# Enhanced SW

An enhanced Splitwise-style expense-sharing application with AI/ML capabilities for intelligent bill splitting, automatic categorization, and spending insights.

## Architecture Overview

The system is designed with a decoupled three-tier architecture:

```
Frontend (Next.js)  ──HTTP REST──>  Backend (Node.js + Express)  ──HTTP REST──>  AI/ML Service (Python FastAPI)
```

### Architectural Principles

1. **Frontend**: Responsible purely for presentation and client interactions. Does not contain business logic, database queries, or direct AI/ML implementations.
2. **Backend (Node.js + Express)**: Serves as the core application and business logic layer, orchestrating database transactions (PostgreSQL, to be configured) and communicating with the AI service.
3. **AI/ML Service (Python FastAPI)**: Specialized microservice dedicated to AI/ML workloads (receipt OCR & parsing, natural language item assignment, expense categorization, spending insights).
4. **Decoupled Communication**: All layer-to-layer communication uses standard HTTP REST APIs. The frontend never talks directly to the Python AI service.

---

## Technology Stack

- **Frontend**: Next.js (App Router), TypeScript, ESLint, npm
- **Backend**: Node.js, Express, TypeScript, tsx, dotenv, cors, npm
- **AI/ML Service**: Python 3.12+, FastAPI, Uvicorn, PaddleOCR / PaddlePaddle (CPU)
- **Database**: PostgreSQL (planned for future phases)
- **Package Manager**: npm (Node.js) / pip (Python)

---

## Directory Structure

```
enhanced-sw/
├── frontend/           # Next.js frontend application (Port 3000)
│   ├── src/
│   │   └── app/        # App Router pages and layout
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── backend/            # Express TypeScript application backend (Port 3001)
│   ├── src/
│   │   ├── app.ts      # Express application setup & route configuration
│   │   └── server.ts   # Server initialization & lifecycle
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── ai-service/         # Python FastAPI AI/ML microservice (Port 8000)
│   ├── .venv/          # Python virtual environment
│   ├── app.py          # FastAPI application & endpoints
│   ├── services/
│   │   └── ocr_service.py # PaddleOCR local inference & reading-order sorting
│   ├── requirements.txt
│   └── .env.example
├── docs/               # Architecture & design documentation
├── .gitignore          # Root gitignore rules
└── README.md           # Project documentation
```

---

## Getting Started

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

---

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

- **Health check endpoint**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- Returns: `{"status": "ok", "service": "enhanced-sw-backend"}`

Additional scripts:
- `npm run typecheck`: Run TypeScript type checking without emitting files.
- `npm run build`: Compile TypeScript into `dist/`.
- `npm run start`: Run compiled production build from `dist/server.js`.

---

### 3. Python AI Service

```bash
cd ai-service

# Create virtual environment (if not already created)
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the AI service
uvicorn app:app --reload --port 8000
```

#### Endpoints

1. **Health Check**:
   - `GET /health`
   - Response: `{"status": "ok", "service": "enhanced-sw-ai"}`

2. **Receipt OCR**:
   - `POST /api/ocr/receipt`
   - Accepts multipart form data with image file (`JPEG`, `PNG`, `WEBP` up to 15MB) under key `file`.
   - **Example Request**:
     ```bash
     curl -X POST http://localhost:8000/api/ocr/receipt \
       -F "file=@path/to/receipt.jpg"
     ```
   - **Example Response**:
     ```json
     {
       "success": true,
       "text": "DOMINOS PIZZA\nMargherita Pizza 299\nFarmhouse Pizza 399\nCoke 80\nTotal 778",
       "lines": [
         {
           "text": "DOMINOS PIZZA",
           "confidence": 0.9689,
           "box": [[20.0, 20.0], [100.0, 20.0], [100.0, 32.0], [20.0, 32.0]]
         },
         {
           "text": "Margherita Pizza 299",
           "confidence": 0.9993,
           "box": [[19.0, 59.0], [126.0, 59.0], [126.0, 73.0], [19.0, 73.0]]
         }
       ]
     }
     ```

3. **Bill Extraction / Normalization**:
   - `POST /api/bill/parse`
   - Accepts raw OCR text JSON payload and parses it using LangChain + Google Gemini LLM into structured bill items, totals, and metadata.
   - **Example Request**:
     ```bash
     curl -X POST http://localhost:8000/api/bill/parse \
       -H "Content-Type: application/json" \
       -d '{"text": "DOMINOSPIZZAE\nMargherita Pizza 299\nFarmhouse Pizza 399\nCoke\n80\nSubtotal\n778\nGST\n3\nTotal\n817"}'
     ```
   - **Example Response**:
     ```json
     {
       "success": true,
       "data": {
         "merchant": "Domino's Pizza",
         "items": [
           {
             "name": "Margherita Pizza",
             "quantity": 1.0,
             "unit_price": 299.0,
             "total_price": 299.0
           },
           {
             "name": "Farmhouse Pizza",
             "quantity": 1.0,
             "unit_price": 399.0,
             "total_price": 399.0
           },
           {
             "name": "Coke",
             "quantity": 1.0,
             "unit_price": 80.0,
             "total_price": 80.0
           }
         ],
         "subtotal": 778.0,
         "tax": 3.0,
         "discount": null,
         "tip": null,
         "total": 817.0,
         "currency": "INR",
         "confidence": "high"
       }
     }
     ```

4. **Natural-Language Consumption Mapping**:
   - `POST /api/bill/assign`
   - Accepts structured bill data, participant names, and natural language instructions. Uses LangChain + Google Gemini to map items to consumers with disambiguation checks.
   - **Example Request**:
     ```bash
     curl -X POST http://localhost:8000/api/bill/assign \
       -H "Content-Type: application/json" \
       -d '{
         "bill": {
           "merchant": "Domino'\''s Pizza",
           "items": [
             {"name": "Margherita Pizza", "total_price": 299.0},
             {"name": "Farmhouse Pizza", "total_price": 399.0},
             {"name": "Coke", "total_price": 80.0}
           ],
           "subtotal": 778.0,
           "tax": 3.0,
           "total": 817.0,
           "currency": "INR"
         },
         "people": ["A", "B", "C"],
         "instruction": "A and B had the Margherita, B and C had the farmhouse, and all three had coke."
       }'
     ```
   - **Example Response**:
     ```json
     {
       "success": true,
       "data": {
         "assignments": [
           {"item_name": "Margherita Pizza", "people": ["A", "B"], "quantity_shares": null},
           {"item_name": "Farmhouse Pizza", "people": ["B", "C"], "quantity_shares": null},
           {"item_name": "Coke", "people": ["A", "B", "C"], "quantity_shares": null}
         ],
         "unassigned_items": [],
         "is_ambiguous": false,
         "ambiguity_reason": null
       }
     }
     ```

5. **Deterministic Bill Splitting & Reconciliation**:
   - `POST /api/bill/split`
   - Full end-to-end splitting: maps consumption via LLM, then uses Python `Decimal` to calculate exact shares, proportional taxes/discounts, and strict cent/paisa total reconciliation.
   - **Example Request**:
     ```bash
     curl -X POST http://localhost:8000/api/bill/split \
       -H "Content-Type: application/json" \
       -d '{
         "bill": {
           "merchant": "Domino'\''s Pizza",
           "items": [
             {"name": "Margherita Pizza", "total_price": 299.0},
             {"name": "Farmhouse Pizza", "total_price": 399.0},
             {"name": "Coke", "total_price": 80.0}
           ],
           "subtotal": 778.0,
           "tax": 3.0,
           "total": 817.0,
           "currency": "INR"
         },
         "people": ["A", "B", "C"],
         "instruction": "A and B had the Margherita, B and C had the farmhouse, and all three had coke."
       }'
     ```
   - **Example Response**:
     ```json
     {
       "success": true,
       "data": {
         "bill": {
           "merchant": "Domino's Pizza",
           "total": 817.0,
           "currency": "INR",
           "subtotal": 778.0,
           "tax": 3.0,
           "discount": null,
           "tip": null
         },
         "assignments": [
           {"item_name": "Margherita Pizza", "people": ["A", "B"], "quantity_shares": null},
           {"item_name": "Farmhouse Pizza", "people": ["B", "C"], "quantity_shares": null},
           {"item_name": "Coke", "people": ["A", "B", "C"], "quantity_shares": null}
         ],
         "shares": [
           {
             "person": "A",
             "items": [
               {"item_name": "Margherita Pizza", "item_total_price": 299.0, "share_fraction": 0.5, "share_amount": 149.5},
               {"item_name": "Coke", "item_total_price": 80.0, "share_fraction": 0.3333333333333333, "share_amount": 26.67}
             ],
             "subtotal": 176.17,
             "tax": 0.68,
             "discount": 0.0,
             "tip": 0.0,
             "total": 196.22
           },
           {
             "person": "B",
             "items": [
               {"item_name": "Margherita Pizza", "item_total_price": 299.0, "share_fraction": 0.5, "share_amount": 149.5},
               {"item_name": "Farmhouse Pizza", "item_total_price": 399.0, "share_fraction": 0.5, "share_amount": 199.5},
               {"item_name": "Coke", "item_total_price": 80.0, "share_fraction": 0.3333333333333333, "share_amount": 26.67}
             ],
             "subtotal": 375.67,
             "tax": 1.45,
             "discount": 0.0,
             "tip": 0.0,
             "total": 418.42
           },
           {
             "person": "C",
             "items": [
               {"item_name": "Farmhouse Pizza", "item_total_price": 399.0, "share_fraction": 0.5, "share_amount": 199.5},
               {"item_name": "Coke", "item_total_price": 80.0, "share_fraction": 0.3333333333333333, "share_amount": 26.67}
             ],
             "subtotal": 226.17,
             "tax": 0.87,
             "discount": 0.0,
             "tip": 0.0,
             "total": 251.36
           }
         ],
         "reconciled_total": 817.0
       }
     }
     ```

6. **Convenience Pipeline**:
   - `POST /api/bill/process`
   - Accepts multipart form data with image `file`, JSON string array `people`, and `instruction` string, executing OCR -> Parse -> Assign -> Split in a single coordinated request.

7. **Automatic Expense Categorization**:
   - `POST /api/expense/categorize` (AI Service) / `POST /api/expenses/categorize` (Backend Proxy)
   - Categorizes an expense description into canonical categories with high/medium/low confidence using multi-provider LLM fallback.
   - **Canonical Categories**: `Food & Dining`, `Transportation`, `Shopping`, `Entertainment`, `Bills & Utilities`, `Healthcare`, `Education`, `Travel`, `Groceries`, `Personal Care`, `Other`.
   - **Example Request**:
     ```bash
     curl -X POST http://localhost:8000/api/expense/categorize \
       -H "Content-Type: application/json" \
       -d '{
         "description": "Uber ride from college to home",
         "amount": 450,
         "merchant": "Uber"
       }'
     ```
   - **Example Response**:
     ```json
     {
       "success": true,
       "data": {
         "category": "Transportation",
         "confidence": "high"
       }
     }
     ```

---

## AI & Mathematical Architecture

### Core Design Principle
> **LLM interprets natural language; deterministic code performs monetary calculations.**

- **AI Responsibilities**: Messy OCR text understanding, line item extraction, natural language consumption resolution, participant matching, and ambiguity detection.
- **Deterministic Responsibilities**: Split fractions, tax/discount proportional allocation, Python `Decimal` fixed-point arithmetic (`ROUND_HALF_UP`), and exact paisa/cent remainder distribution so `sum(shares) == bill.total`.

---

## Testing

Run unit and integration tests:

```bash
cd ai-service
source .venv/bin/activate
pytest -v
```

