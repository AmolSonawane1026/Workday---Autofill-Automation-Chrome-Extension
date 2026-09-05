# AI-Powered Workday Job Application Automation (Chrome Extension MV3)

> **Chrome Extension (Manifest V3) & AI Automation Service** for multi-step Workday application forms powered by **Google Gemini AI**. Primary test target: **NVIDIA Workday Portal** (`nvidia.wd5.myworkdayjobs.com`), generalizable across enterprise Workday instances (e.g., Target).

---

## 🌟 Key Features

1. **AI Resume Parser (PDF & DOCX)**:
   - Client-side browser-compatible extraction with `pdfjs-dist` and `mammoth.js`.
   - Google Gemini structured JSON transformation for personal info, experience, education, skills, and work authorization.
   - Interactive **Profile Editor** for reviewing and refining details.

2. **Workday DOM Automation Engine**:
   - **React Native Prototype Setter Dispatching**: Dispatches prototype setters to ensure React state synchronizes accurately.
   - **Custom Workday Combobox / Listbox Selection**: Handles Workday dynamic dropdown popups with fuzzy option matching.
   - **Repeatable Sections**: Supports adding experience and education items dynamically.
   - **MutationObserver**: Reacts to dynamically rendered sub-forms and modals.
   - **Visual Feedback**: Applies green glowing highlights on filled fields.

3. **Hybrid Field Mapping**:
   - **Tier 1 (Instant Heuristics)**: Direct pattern matching on standard labels (`First Name`, `Last Name`, `Email`, `Phone`, `Address`, `LinkedIn`, `GitHub`, `Work Auth`).
   - **Tier 2 (Google Gemini Semantic Reasoning)**: Resolves complex questionnaires, custom screening prompts, and voluntary EEO disclosures (`gemini-1.5-flash` / `gemini-1.5-pro`).
   - **Confidence Badges**: Displays High (Green), Medium (Yellow), and Low (Red) ratings with explanation.

4. **In-Page Floating Assistant (Shadow DOM)**:
   - Injected directly into Workday pages inside an isolated Shadow Root (`#workday-ai-assistant-root`) to prevent CSS conflicts.
   - Real-time step tracker and one-click autofill trigger.

5. **Security & Privacy**:
   - **AES-GCM 256-bit Web Crypto Encryption**: API keys are encrypted with PBKDF2 device-bound key derivation.
   - **Client-Side Isolated**: All data remains in local Chrome storage.
   - **Mandatory User Confirmation**: Requires explicit confirmation before final application submission.

---

## 📂 Project Layout

```
├── backend/                  # Production Express.js AI & Automation Backend
│   ├── src/
│   │   ├── config/           # Environment & Port configuration
│   │   ├── controllers/      # Resume, AI Mapping, and Workday Diagnostic Controllers
│   │   ├── routes/           # REST API routes with Rate Limiting
│   │   ├── services/         # Google Gemini, Parser, and Heuristic Services
│   │   └── server.js         # Express server with Helmet & CORS
│   ├── tests/                # Node unit tests
│   └── package.json
│
├── frontend/                 # Chrome Extension (Manifest V3)
│   ├── public/
│   │   ├── manifest.json     # Manifest V3 Configuration
│   │   └── icons/            # Extension PNG icons (16px, 48px, 128px)
│   ├── src/
│   │   ├── background/       # Service Worker message router
│   │   ├── content/          # Workday DOM Extractor, Filler, Observer, Overlay
│   │   ├── core/             # AES-GCM encryption, Gemini client, hybrid mapper
│   │   └── popup/            # React 18 + JavaScript + TailwindCSS interface
│   ├── tests/                # Vitest unit test suite (5/5 passed)
│   ├── vite.config.js        # Extension build configuration
│   └── package.json
│
├── docs/                     # Technical Documentation
│   ├── SETUP.md              # Installation & Chrome Unpacked Loading Guide
│   ├── ARCHITECTURE.md       # Architectural diagrams & DOM interaction engine
│   ├── AI_STRATEGY.md        # Prompt engineering, schemas, and confidence scoring
│   └── LIMITATIONS.md        # Edge cases, auth boundaries, Workday nuances
│
└── README.md                 # Project Overview
```

---

## 🚀 Quick Start Guide

### 1. Build Extension

```bash
cd frontend
npm install
npm run build
```

### 2. Load Extension in Chrome

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `frontend/dist` directory.

### 3. Run Automated Tests

```bash
# Frontend Vitest Suite
cd frontend
npm run test

# Backend Node Suite
cd ../backend
npm test
```

---

## 🎯 Target Platform Verification

- **Primary Target**: NVIDIA Workday Portal (`nvidia.wd5.myworkdayjobs.com`)
- **Secondary Target**: Target Workday Portal (`target.wd5.myworkdayjobs.com`)

---

## 📄 Documentation Links

- [Setup & Installation Guide](file:///c:/Users/sonaw/OneDrive/Desktop/Hidani_Tech_Assesment/docs/SETUP.md)
- [System Architecture](file:///c:/Users/sonaw/OneDrive/Desktop/Hidani_Tech_Assesment/docs/ARCHITECTURE.md)
- [AI Strategy & Prompt Engineering](file:///c:/Users/sonaw/OneDrive/Desktop/Hidani_Tech_Assesment/docs/AI_STRATEGY.md)
- [Limitations & Security Guardrails](file:///c:/Users/sonaw/OneDrive/Desktop/Hidani_Tech_Assesment/docs/LIMITATIONS.md)
