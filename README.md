# 🧠 CodeMind: AI-Powered RAG Codebase Assistant

CodeMind is a premium, developer-centric codebase search and learning tool. It allows developers and students to clone any public repository (including multi-language, C/C++, Rust, Python, TypeScript, and Go projects) and chat with it in real-time. CodeMind retrieves precise code snippets using local vectors, indexes class and method definitions with syntax-aware AST parsers, and features a specialized **Tutor & Interview Prep Mode** to teach students in depth.

---

## ✨ Features

### 1. 🎓 Tutor & Interview Prep Mode
Shift the assistant from a general coding helper into a specialized mentor. When enabled, CodeMind adopts a pedagogical persona:
* **Analogy-Based Explanations**: Explains complex designs (like thread pools, pointers, and memory blocks) using intuitive real-world examples.
* **Code Quiz Generation**: Creates multi-choice or short-answer comprehension quizzes directly in the chat bubble.
* **Architecture Flowcharts**: Maps out function call diagrams and data pipelines using readable ASCII sequence charts.
* **Mock Technical Interviews**: Conducts simulated system design and review sessions with scorecards.
* **Quick-Actions Toolbar**: Easily fire educational actions with one click directly above the chat text bar.

### 2. ⚡ Fast Concurrent Indexing
* Parallelizes chunk embedding requests using a Python `ThreadPoolExecutor` (configured for up to 16 workers) in [vector_service.py](file:///c:/Users/DeepakKumar/Desktop/Product_Squad%20Assignment/RAG%20Project/backend/app/services/vector_service.py).
* Achieves connection reuse and eliminates TCP socket overhead using a persistent `httpx.Client` pool.

### 3. 🔬 Multi-Language AST Parsing
* Scans and parses standard files for Python, TypeScript, JavaScript, Go, Java, C++, C, Rust, C#, PHP, Ruby, Swift, Kotlin, Shell, HTML, CSS, JSON, YAML, and Markdown.
* Hooks up [tree-sitter-cpp](file:///c:/Users/DeepakKumar/Desktop/Product_Squad%20Assignment/RAG%20Project/backend/app/services/parser_service.py) and [tree-sitter-c](file:///c:/Users/DeepakKumar/Desktop/Product_Squad%20Assignment/RAG%20Project/backend/app/services/parser_service.py) to extract precise class declarations, function bindings, structures, and method namespaces.

### 4. 📐 Maximize Overlay Layout
* Click the expand/maximize button in the header of [ChatWindow.tsx](file:///c:/Users/DeepakKumar/Desktop/Product_Squad%20Assignment/RAG%20Project/frontend/src/components/ChatWindow.tsx) to expand the chatbot screen into full-screen overlay mode. Helpful for analyzing long files or architecture guides.

### 5. 🛑 SSE Stream Stop Control
* Stop response generation mid-stream. The send button dynamically switches to a red Stop button when active, allowing you to halt Ollama streaming immediately by triggering an abort request signal.

---

## 🛠️ Technology Stack
* **Frontend**: React 19, Next.js (Turbopack), TypeScript, TailwindCSS, Lucide React, Prism Highlighting, Markdown Rendering.
* **Backend**: FastAPI, Python 3, SQLite, SQLAlchemy ORM, tree-sitter.
* **AI Engine**: Ollama running locally.
  * Default LLM: `qwen2.5-coder:1.5b`
  * Embeddings Model: `nomic-embed-text`

---

## 🚀 Step-by-Step User & Setup Guide

### Step 1: Install & Run Ollama (Local LLM)
1. Download and install [Ollama](https://ollama.com/) for Windows.
2. Open PowerShell and run these commands to pull the necessary models:
   ```bash
   ollama pull qwen2.5-coder:1.5b
   ollama pull nomic-embed-text
   ```
3. Verify that the Ollama service is active on `http://localhost:11434`.

---

### Step 2: Configure & Start the Backend
1. Open a terminal in the [backend](file:///c:/Users/DeepakKumar/Desktop/Product_Squad%20Assignment/RAG%20Project/backend) directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server using Uvicorn:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
   The backend API documentation is available at `http://127.0.0.1:8000/docs`.

---

### Step 3: Configure & Start the Frontend
1. Open a new terminal in the [frontend](file:///c:/Users/DeepakKumar/Desktop/Product_Squad%20Assignment/RAG%20Project/frontend) directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 📖 How to Use CodeMind

### 1. Indexing a Repository
* Paste any public repository link (e.g., `https://github.com/example/repo`) in the sidebar search input.
* Click **Add Repo**. CodeMind will clone, scan extensions, parse AST functions, generate embeddings, and load chunks.
* The sidebar status will show **Cloning** ➡️ **Parsing** ➡️ **Indexing** ➡️ **Ready**.

### 2. Standard Chat Mode
* Select your repository from the sidebar.
* Ask questions about file logic, database tables, or function structures in standard chat mode.
* Click the file badges under chatbot responses to open the code directly inside the center file viewer.

### 3. Activating Tutor Mode
* Toggle the **🎓 Tutor Mode** button on the right side of the chat header panel.
* Use the dynamic quick-action toolbar (**Tutor Explain**, **Interview Prep**, **Mock Q&A**, **Architecture**) to automatically format and execute targeted study prompts.
* Toggle the **Maximize** button to read responses full-screen.
* If the LLM generates a long paragraph and you have enough information, click the red **Stop** button to immediately halt streaming.
