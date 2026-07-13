"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import RepoExplorer from "@/components/RepoExplorer";
import ChatWindow from "@/components/ChatWindow";
import ToastContainer from "@/components/ToastContainer";
import { Repository } from "@/lib/api";
import { Brain, Zap } from "lucide-react";

export default function Home() {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  
  // Settings state, loaded from localStorage if exists
  const [settings, setSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("codemind_settings");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return {
      llmModel: "qwen2.5-coder:1.5b",
      embeddingModel: "nomic-embed-text",
      topK: 5,
      temperature: 0.2,
    };
  });

  // Code Viewer state
  const [activeFile, setActiveFile] = useState<{ path: string; highlightLines?: [number, number] } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const handleSelectRepo = useCallback((repo: Repository | null) => {
    setSelectedRepo(repo);
    setActiveFile(null);
  }, []);

  const updateSettings = useCallback((newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem("codemind_settings", JSON.stringify(newSettings));
  }, []);

  const handleSelectFile = useCallback((path: string, highlightLines?: [number, number]) => {
    setActiveFile({ path, highlightLines });
  }, []);

  return (
    <div className="app-shell">
      {/* ---- Topbar ---- */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <Brain size={14} color="white" />
          </div>
          <span className="topbar-title">CodeMind</span>
          <span className="topbar-subtitle">AI Codebase Assistant</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.20)",
            borderRadius: 99,
            fontSize: 11,
            color: "#34d399",
          }}>
            <Zap size={11} />
            Powered by Ollama
          </div>
        </div>
      </header>

      {/* ---- Sidebar ---- */}
      <Sidebar
        selectedRepo={selectedRepo}
        onSelectRepo={handleSelectRepo}
        onToast={showToast}
        settings={settings}
        onSettingsChange={updateSettings}
      />

      {/* ---- Middle Explorer ---- */}
      <RepoExplorer
        selectedRepo={selectedRepo}
        onToast={showToast}
        activeFile={activeFile}
        setActiveFile={setActiveFile}
        onSelectFile={handleSelectFile}
      />

      {/* ---- Chat Window ---- */}
      <ChatWindow
        selectedRepo={selectedRepo}
        onToast={showToast}
        settings={settings}
        onSelectFile={handleSelectFile}
      />

      {/* ---- Toast Notifications ---- */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
