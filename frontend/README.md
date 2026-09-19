# Enhanced Splitwise Frontend (Expo React Native + TypeScript)

Minimal mobile-first frontend for Feature 1: **Intelligent Bill Splitting**.

## Architecture & Flow

```text
React Native / Expo (Port 8081 / Web 8081)
        ↓
Node.js / Express Backend (Port 3001)
        ↓
Python FastAPI AI Service (Port 8000)
```

## Setup & Running

### 1. Configure API Base URL

Copy `.env.example` to `.env` in `frontend/`:

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` based on your environment:

- **Web browser / Localhost:**
  ```env
  EXPO_PUBLIC_API_URL=http://localhost:3001
  ```
- **Android Emulator:**
  ```env
  EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
  ```
- **Physical Android / iOS device (on same Wi-Fi):**
  ```env
  EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3001
  ```
  *(e.g. `http://192.168.1.100:3001`)*

### 2. Start the App

```bash
# Start Expo development server (opens interactive QR code / web / android options)
npm start

# Or launch directly on Web
npm run web

# Or launch on Android device / emulator
npm run android
```

### 3. Typecheck

```bash
npm run typecheck
```

## Project Structure

```text
frontend/
├── App.tsx                     # Main coordinating component with 3-stage flow
├── app.json                    # Expo configuration
├── components/
│   ├── ErrorBanner.tsx         # Clean error display with retry/dismiss
│   ├── Header.tsx              # Mobile header
│   ├── InstructionInput.tsx    # Multiline natural language consumption input
│   ├── LoadingOverlay.tsx      # Processing status indicator
│   ├── ParticipantInput.tsx    # Participant chips, add/remove
│   ├── ReceiptUploader.tsx     # Stage 1 receipt selector
│   └── SplitResultView.tsx     # Results screen (shares, items, reconciled total, validation)
├── services/
│   └── api.ts                  # API service client connecting to Node backend proxy
├── types/
│   └── bill.ts                 # TypeScript type definitions
└── tsconfig.json
```
