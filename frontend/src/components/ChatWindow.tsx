"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Send, MessageSquare, Sparkles, Copy, Check,
  FileCode2, Bot, User, Zap, AlertCircle, Maximize2, Minimize2,
} from "lucide-react";
import { Repository, SourceNode, streamChat } from "@/lib/api";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: SourceNode[];
  isStreaming?: boolean;
}

interface Props {
  selectedRepo: Repository | null;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
  settings: {
    llmModel: string;
    embeddingModel: string;
    topK: number;
    temperature: number;
  };
  onSelectFile: (path: string, highlightLines?: [number, number]) => void;
}

const SUGGESTED_QUESTIONS = [
  "How does authentication work?",
  "Explain this repository",
  "Find all API endpoints",
  "How is the database connected?",
  "Explain the main class",
  "Where is JWT generated?",
];

const TUTOR_QUESTIONS = [
  "🎓 Teach me this codebase in-depth like a tutor",
  "📝 Prepare an interview study guide for this repo",
  "❓ Generate 5 interview questions about this codebase with answers",
  "🏛️ Explain the high-level architecture and main logic flow",
];

export default function ChatWindow({ selectedRepo, onToast, settings, onSelectFile }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sources, setSources] = useState<SourceNode[]>([]);
  const [tutorMode, setTutorMode] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setSources([]);
  }, [selectedRepo?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (query?: string) => {
    const text = (query || input).trim();
    if (!text || !selectedRepo || streaming) return;
    if (selectedRepo.status !== "ready") {
      onToast("Repository is not ready yet. Please wait for indexing to complete.", "info");
      return;
    }

    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    const aiMsgId = Date.now() + 1;
    const aiMsg: Message = { id: aiMsgId, role: "assistant", content: "", isStreaming: true, sources: [] };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setStreaming(true);
    setSources([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let accumulated = "";
      let msgSources: SourceNode[] = [];

      for await (const event of streamChat(
        selectedRepo.id,
        text,
        settings.llmModel,
        settings.topK,
        settings.temperature,
        tutorMode ? "teacher" : "default",
        controller.signal
      )) {
        if (event.type === "sources" && event.sources) {
          msgSources = event.sources;
          setSources(event.sources);
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, sources: event.sources } : m))
          );
        } else if (event.type === "token" && event.content) {
          accumulated += event.content;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated } : m))
          );
        } else if (event.type === "done") {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false } : m))
          );
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, isStreaming: false, content: m.content + "\n\n*(Generation stopped by user)*" }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "Error: Could not connect to backend. Make sure the server is running.", isStreaming: false }
              : m
          )
        );
        onToast("Connection error", "error");
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  }, [input, selectedRepo, streaming, onToast, tutorMode]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      onToast("Generation stopped", "info");
    }
  }, [onToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedRepo) {
    return (
      <aside className="chat-panel">
        <div className="empty-state" style={{ height: "100%" }}>
          <div className="empty-state-icon">
            <MessageSquare size={28} color="#4f46e5" />
          </div>
          <div className="empty-title">Select a repository</div>
          <div className="empty-desc">Pick a repository from the sidebar to start chatting with your codebase</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={`chat-panel ${isMaximized ? "maximized" : ""}`}>
      {/* ---- Header ---- */}
      <div className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={13} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>CodeMind Chat</div>
            <div style={{ fontSize: 10, color: "#475569" }}>{selectedRepo.name}</div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => {
              setTutorMode(!tutorMode);
              onToast(
                tutorMode
                  ? "Tutor Mode Disabled"
                  : "Tutor Mode Enabled: In-depth learning & Interview prep active!",
                "info"
              );
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              background: tutorMode ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.03)",
              border: tutorMode ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 500,
              color: tutorMode ? "#818cf8" : "#94a3b8",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            🎓 Tutor Mode
          </button>

          {selectedRepo.status !== "ready" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f59e0b" }}>
              <AlertCircle size={12} />
              Not ready
            </div>
          )}
          {selectedRepo.status === "ready" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#34d399" }}>
              <Zap size={11} />
              Ready
            </div>
          )}
          
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title={isMaximized ? "Minimize Chat" : "Maximize Chat"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* ---- Messages ---- */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <WelcomeScreen tutorMode={tutorMode} onSuggest={handleSend} />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onToast={onToast}
              onSelectFile={onSelectFile}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ---- Sources Panel ---- */}
      {sources.length > 0 && (
        <div className="sources-panel">
          <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <FileCode2 size={11} />
            Sources used ({sources.length})
          </div>
          {sources.map((src, i) => (
            <div
              key={i}
              className="source-item"
              onClick={() => onSelectFile(src.file_path, [src.start_line, src.end_line])}
            >
              <FileCode2 size={11} color="#6366f1" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="source-file">{src.file_path}</div>
                {src.name && (
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{src.chunk_type}: {src.name}</div>
                )}
              </div>
              <div className="source-lines">L{src.start_line}–{src.end_line}</div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Input ---- */}
      <div className="chat-input-area">
        {tutorMode && (
          <div style={{
            display: "flex",
            gap: 6,
            padding: "0 0 10px 0",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}>
            <button
              className="tutor-tool-chip"
              onClick={() => handleSend("🎓 Teach me this codebase in-depth like a tutor")}
              disabled={streaming}
            >
              🎓 Tutor Explain
            </button>
            <button
              className="tutor-tool-chip"
              onClick={() => handleSend("📝 Prepare an interview study guide for this repo")}
              disabled={streaming}
            >
              📝 Interview Prep
            </button>
            <button
              className="tutor-tool-chip"
              onClick={() => handleSend("❓ Generate 5 interview questions about this codebase with answers")}
              disabled={streaming}
            >
              ❓ Mock Q&A
            </button>
            <button
              className="tutor-tool-chip"
              onClick={() => handleSend("🏛️ Explain the high-level architecture and main logic flow")}
              disabled={streaming}
            >
              🏛️ Architecture
            </button>
          </div>
        )}
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Ask about this codebase…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={streaming}
            style={{ minHeight: 20 }}
          />
          {streaming ? (
            <button
              className="stop-btn"
              onClick={handleStop}
              style={{
                width: 32,
                height: 32,
                background: "#ef4444",
                border: "none",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              title="Stop Generation"
            >
              <div style={{ width: 8, height: 8, background: "white", borderRadius: 1 }} />
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim()}
            >
              <Send size={13} color="white" />
            </button>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#1e293b", marginTop: 6, textAlign: "center" }}>
          Press Enter to send · Shift+Enter for new line
        </div>
      </div>
    </aside>
  );
}

function WelcomeScreen({ tutorMode, onSuggest }: { tutorMode: boolean; onSuggest: (q: string) => void }) {
  const questions = tutorMode ? TUTOR_QUESTIONS : SUGGESTED_QUESTIONS;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>
      <div style={{
        width: 52, height: 52,
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        borderRadius: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12,
        boxShadow: "0 8px 24px rgba(99,102,241,0.30)",
      }}>
        <Sparkles size={22} color="white" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#c7d2fe", marginBottom: 4 }}>
        {tutorMode ? "CodeMind Tutor Mode" : "Ask CodeMind"}
      </div>
      <div style={{ fontSize: 12, color: "#475569", textAlign: "center", marginBottom: 20 }}>
        {tutorMode 
          ? "Ask for structured study guides, architecture walkthroughs, or interview practice questions."
          : "Ask anything about this codebase and get AI-powered answers with source citations"}
      </div>
      <div className="suggestions-grid">
        {questions.map((q) => (
          <button key={q} className="suggestion-chip" onClick={() => onSuggest(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onToast,
  onSelectFile,
}: {
  message: Message;
  onToast: (m: string, t?: any) => void;
  onSelectFile: (path: string, highlightLines?: [number, number]) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`fade-in ${isUser ? "message-user" : "message-ai"}`}>
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: "linear-gradient(135deg,#6366f1,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={11} color="white" />
          </div>
          <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>CodeMind</span>
        </div>
      )}

      <div className="bubble">
        {isUser ? (
          <span>{message.content}</span>
        ) : message.isStreaming && !message.content ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        ) : (
          <MarkdownContent content={message.content} onToast={onToast} />
        )}
      </div>

      {/* Per-message sources */}
      {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {message.sources.map((s, i) => (
            <span key={i} style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "rgba(99,102,241,0.10)",
              border: "1px solid rgba(99,102,241,0.20)",
              borderRadius: 99,
              color: "#a5b4fc",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
              title={`Lines ${s.start_line}–${s.end_line}`}
              onClick={() => onSelectFile(s.file_path, [s.start_line, s.end_line])}
            >
              {s.file_path.split("/").pop()} L{s.start_line}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content, onToast }: { content: string; onToast: (m: string, t?: any) => void }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock = !props.inline && match;
          const codeString = String(children).replace(/\n$/, "");

          if (isBlock) {
            return <CodeBlock lang={match[1]} code={codeString} onToast={onToast} />;
          }
          return <code className={className} {...props}>{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CodeBlock({ lang, code, onToast }: { lang: string; code: string; onToast: (m: string, t?: any) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      onToast("Code copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(0,0,0,0.40)",
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono)" }}>{lang}</span>
        <button className="copy-btn" onClick={handleCopy} style={{ position: "static" }}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 10px 10px",
          fontSize: 12,
          padding: "12px",
          background: "#0d1117",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
