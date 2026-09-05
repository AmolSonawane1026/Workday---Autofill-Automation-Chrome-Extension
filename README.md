# Workday Job Application Autofill Assistant (Chrome Extension MV3)

An intelligent Chrome Extension (Manifest V3) and backend service designed to automate multi-step job applications on Workday portals.

---

## 🎯 Verified On Live Workday Portals

This automation extension was actively developed, tested, and verified on live Workday job applications, specifically:

- **Target Workday Portal Application:**  
  [Target Lead Engineer Application Posting](https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/7000-Target-Pkwy-NNCD-0375-Brooklyn-ParkMN-55445/Lead-Engineer---Cloud-Security--Software-Engineering-_R0000448693-1?q=software%20developer)
- Tested across similar Workday enterprise career portals (including Target, NVIDIA, and standard Workday `wd5.myworkdayjobs.com` application flows).

### Verified Multi-Step Coverage:
1. **Step 1 (My Information):** Contact details (First/Last name, Email, Phone, Country code), geographic location reasoning (City, State, Postal code), and source selection.
2. **Step 2 (My Experience):** Dynamic expansion of multiple Work Experience cards, Education cards (degree standard listbox & field of study selection), skills multiselect search & tag insertion, website/social links, and direct resume file attachment.
3. **Step 3 (Application Questions):** Work authorization questions, visa sponsorship, and screening prompts.
4. **Step 4 (Voluntary Disclosures):** Equal Employment Opportunity (EEO) disclosures, gender inference, ethnicity, veteran status, self-identification, and required terms agreement.
5. **Step 5 (Review):** Final summary inspection with explicit user confirmation before any final submission.

---

## 🛠️ Prerequisites

Before you start, make sure you have the following installed on your machine:

- **Node.js** (v18 or higher) & **npm**
- **Python** (v3.10 or higher)
- **Google Chrome** browser

---

## 🚀 Step-by-Step Setup Guide

### 1. Backend Setup & Run

The backend handles resume parsing, location reasoning, and AI-driven field mapping.

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Install Node.js and Python dependencies:
   ```bash
   # Install Node.js backend dependencies
   npm install

   # Install Python helper dependencies (FastAPI, Uvicorn, Google GenAI, Selenium)
   pip install -r python/requirements.txt
   ```

3. Configure your environment variables:
   - Create or check the `.env` file in the `backend` folder (you can copy `.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   GEMINI_API_KEY=your_google_gemini_api_key_here
   DEFAULT_MODEL=gemini-1.5-flash
   CLIENT_URL=*
   PYTHON_SERVER_URL=http://127.0.0.1:8000
   ```

4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will start running on `http://localhost:5000` and automatically supervise the Python helper service on `http://127.0.0.1:8000`.*

---

### 2. Frontend Setup & Chrome Extension Installation

1. Open a second terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Verify the environment configuration:
   - The `.env` file in `frontend` specifies:
   ```env
   VITE_BACKEND_URL=http://localhost:5000
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_DEFAULT_MODEL=gemini-1.5-flash
   ```

4. Build the extension package:
   ```bash
   npm run build
   ```
   *This compiles all React components, content scripts, and background service workers into the `frontend/dist` folder.*

---

### 3. Loading the Extension into Google Chrome

1. Open **Google Chrome** and go to `chrome://extensions` in the address bar.
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button in the top-left corner.
4. Browse and select the **`frontend/dist`** folder inside this project.
5. The extension icon **Workday AI Autofill Assistant** will now appear in your Chrome toolbar. Pin it for easy access!

---

## 💡 How to Use the Extension

1. **Open the Extension Popup:**
   - Click on the extension icon in your toolbar.
2. **Upload Your Resume (Resume Tab):**
   - Drag and drop your PDF or DOCX resume.
   - The assistant parses your personal information, work experience, education, skills, and links.
3. **Configure API Key / Settings (Settings Tab):**
   - If using direct client mode, enter your Google Gemini API key. If the backend is running, it will automatically connect.
4. **Navigate to a Workday Job Application:**
   - Open any Workday job application page (such as the Target job link above).
5. **Autofill the Application (Autofill Tab):**
   - Click **Fill Standard Application (Steps 1 - 4)** or use the individual step autofill buttons.
   - Watch the extension fill form fields, select dropdowns, search and tag skills, and expand experience sections.
   - Review your details on the final step before submitting.

---

## 📌 Practical Tips & Best Practices

- **Workday Sign-In:** Ensure you log in to your Workday candidate account (or create one) on the job portal before initiating the application so the multi-step form fields are rendered.
- **Reloading the Extension:** If you rebuild the frontend (`npm run build`), click the **Reload** (🔄) button on the extension card in `chrome://extensions` and refresh the Workday tab.
- **API Key Options:** The extension can authenticate directly via the `GEMINI_API_KEY` in your `backend/.env` file, or you can paste your key in the extension's **Settings** tab.
- **Review Before Submission (Step 5):** The extension automates Steps 1 through 4, leaving Step 5 open for you to verify all populated information before submitting.

---

## 📁 Project Structure

```
├── backend/                  # Node.js Express server & Python services
│   ├── src/                  # Controllers, routes, and services
│   ├── python/               # Location reasoner and parsing graph
│   ├── .env                  # Backend environment settings
│   └── package.json
│
├── frontend/                 # Manifest V3 Chrome Extension
│   ├── src/
│   │   ├── content/          # Workday DOM extractors, step fillers, observer
│   │   ├── core/             # Configuration, security storage, resume parser
│   │   ├── background/       # Service worker message routing
│   │   └── popup/            # Extension React popup interface
│   ├── dist/                 # Production-built unpacked extension
│   ├── .env                  # Frontend environment variables
│   ├── vite.config.js        # Vite + esbuild bundling config
│   └── package.json
│
└── README.md
```
