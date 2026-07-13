"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch, Plus, Trash2, RefreshCw, Settings, X, Loader2,
  FolderGit2, ChevronRight,
} from "lucide-react";
import {
  Repository, listRepositories, addRepository, deleteRepository, refreshRepository, API_BASE_URL,
} from "@/lib/api";
import { cn, getStatusColor, getStatusLabel, timeAgo } from "@/lib/utils";

interface Props {
  selectedRepo: Repository | null;
  onSelectRepo: (r: Repository | null) => void;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
  settings: {
    llmModel: string;
    embeddingModel: string;
    topK: number;
    temperature: number;
  };
  onSettingsChange: (s: {
    llmModel: string;
    embeddingModel: string;
    topK: number;
    temperature: number;
  }) => void;
}

export default function Sidebar({ selectedRepo, onSelectRepo, onToast, settings, onSettingsChange }: Props) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [activePanel, setActivePanel] = useState<"repos" | "settings">("repos");

  // Polling every 4s to pick up status changes (cloning → indexing → ready)
  const fetchRepos = useCallback(async () => {
    try {
      const data = await listRepositories();
      setRepos(data);
      // Update selectedRepo if its status changed
      if (selectedRepo) {
        const updated = data.find((r) => r.id === selectedRepo.id);
        if (updated && updated.status !== selectedRepo.status) {
          onSelectRepo(updated);
        }
      }
    } catch {}
  }, [selectedRepo, onSelectRepo]);

  useEffect(() => {
    fetchRepos();
    const interval = setInterval(fetchRepos, 4000);
    return () => clearInterval(interval);
  }, [fetchRepos]);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const repo = await addRepository(newUrl.trim());
      setRepos((prev) => [repo, ...prev]);
      onSelectRepo(repo);
      setNewUrl("");
      setShowAdd(false);
      onToast("Repository added! Cloning in progress…", "success");
    } catch (e: any) {
      onToast(e.message || "Failed to add repository", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (repo: Repository, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteRepository(repo.id);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
      if (selectedRepo?.id === repo.id) onSelectRepo(null);
      onToast("Repository deleted", "info");
    } catch {
      onToast("Failed to delete repository", "error");
    }
  };

  const handleRefresh = async (repo: Repository, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await refreshRepository(repo.id);
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? updated : r)));
      onToast("Re-indexing started…", "info");
    } catch {
      onToast("Failed to refresh repository", "error");
    }
  };

  return (
    <aside className="sidebar">
      {/* ---- Nav Tabs ---- */}
      <div style={{ display: "flex", padding: "10px 8px 0", gap: 4 }}>
        {[
          { id: "repos", label: "Repositories", icon: FolderGit2 },
          { id: "settings", label: "Settings", icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id as any)}
            className={cn("btn btn-ghost", activePanel === id && "active")}
            style={{
              flex: 1,
              justifyContent: "center",
              borderRadius: 8,
              fontSize: 11,
              padding: "5px 8px",
              ...(activePanel === id
                ? {
                    background: "rgba(99,102,241,0.12)",
                    color: "#c7d2fe",
                    border: "1px solid rgba(99,102,241,0.25)",
                  }
                : {}),
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {activePanel === "repos" ? (
        <>
          {/* ---- Add Repo Button ---- */}
          <div style={{ padding: "10px 8px 6px" }}>
            {!showAdd ? (
              <button
                className="btn btn-primary"
                onClick={() => setShowAdd(true)}
                style={{ width: "100%", justifyContent: "center", padding: "8px" }}
              >
                <Plus size={13} />
                Add Repository
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  className="form-input"
                  placeholder="https://github.com/owner/repo"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                  style={{ fontSize: 12 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleAdd}
                    disabled={adding || !newUrl.trim()}
                    style={{ flex: 1, justifyContent: "center", padding: "6px" }}
                  >
                    {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {adding ? "Adding…" : "Add"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => { setShowAdd(false); setNewUrl(""); }}
                    style={{ padding: "6px 10px" }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="divider" style={{ margin: "4px 12px" }} />
          <div className="sidebar-section">Repositories</div>

          {/* ---- Repo List ---- */}
          <div className="sidebar-content">
            {repos.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 16px" }}>
                <div className="empty-state-icon">
                  <GitBranch size={24} color="#4f46e5" />
                </div>
                <div className="empty-title">No repositories yet</div>
                <div className="empty-desc">Add a GitHub URL to start analyzing code</div>
              </div>
            ) : (
              repos.map((repo) => {
                const isActive = selectedRepo?.id === repo.id;
                const isProcessing = ["cloning", "parsing", "indexing"].includes(repo.status);
                return (
                  <div
                    key={repo.id}
                    className={cn("repo-card", isActive && "active")}
                    onClick={() => onSelectRepo(repo)}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="repo-card-name">{repo.name}</div>
                        <div className="repo-card-meta">
                          <span
                            className="status-dot"
                            style={{
                              background:
                                repo.status === "ready" ? "#10b981"
                                  : repo.status === "error" ? "#ef4444"
                                    : "#6366f1",
                            }}
                          />
                          <span className={getStatusColor(repo.status)}>
                            {getStatusLabel(repo.status)}
                          </span>
                          <span>·</span>
                          <span>{timeAgo(repo.updated_at)}</span>
                        </div>
                        {isProcessing && (
                          <div className="progress-bar" style={{ marginTop: 6 }} />
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
                        <button
                          className="btn btn-ghost"
                          onClick={(e) => handleRefresh(repo, e)}
                          style={{ padding: "3px", width: 24, height: 24 }}
                          title="Re-index"
                        >
                          <RefreshCw size={11} />
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={(e) => handleDelete(repo, e)}
                          style={{ padding: "3px", width: 24, height: 24 }}
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {repo.status === "ready" && repo.total_chunks > 0 && (
                      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#475569" }}>
                          {repo.indexed_files} files · {repo.total_chunks} chunks
                        </span>
                      </div>
                    )}

                    {repo.status === "error" && repo.error_message && (
                      <div style={{
                        fontSize: 10,
                        color: "#fca5a5",
                        marginTop: 4,
                        padding: "4px 6px",
                        background: "rgba(239,68,68,0.10)",
                        borderRadius: 6,
                        wordBreak: "break-word",
                      }}>
                        {repo.error_message.substring(0, 80)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onToast={onToast} />
      )}
    </aside>
  );
}

interface SettingsPanelProps {
  settings: {
    llmModel: string;
    embeddingModel: string;
    topK: number;
    temperature: number;
  };
  onSettingsChange: (s: {
    llmModel: string;
    embeddingModel: string;
    topK: number;
    temperature: number;
  }) => void;
  onToast: (m: string, t?: any) => void;
}

function SettingsPanel({ settings, onSettingsChange, onToast }: SettingsPanelProps) {
  const [models, setModels] = useState<string[]>([]);
  const [apiUrlInput, setApiUrlInput] = useState(API_BASE_URL);

  useEffect(() => {
    fetch(`${API_BASE_URL}/settings/`)
      .then((r) => r.json())
      .then((d) => {
        setModels(d.available_models || []);
      })
      .catch(() => {});
  }, []);

  const handleChange = (key: string, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="sidebar-content" style={{ paddingTop: 12 }}>
      <div className="sidebar-section" style={{ padding: "0 6px 10px" }}>Configuration</div>
      <div className="settings-panel">
        <div className="settings-group">
          <label className="settings-label">Backend API URL</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="form-input"
              value={apiUrlInput}
              onChange={(e) => setApiUrlInput(e.target.value)}
              style={{ fontSize: 12 }}
              placeholder="e.g. http://localhost:8000/api/v1"
            />
            <button
              onClick={() => {
                localStorage.setItem("codemind_api_url", apiUrlInput.trim());
                onToast("Backend URL updated! Reloading...", "success");
                setTimeout(() => window.location.reload(), 1000);
              }}
              style={{
                padding: "0 10px",
                background: "rgba(99,102,241,0.20)",
                border: "1px solid rgba(99,102,241,0.40)",
                borderRadius: 8,
                fontSize: 11,
                color: "#818cf8",
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>

        <div className="settings-group">
          <label className="settings-label">LLM Model</label>
          {models.length > 0 ? (
            <select
              className="settings-select"
              value={settings.llmModel}
              onChange={(e) => handleChange("llmModel", e.target.value)}
            >
              {models.map((m) => <option key={m}>{m}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 11, color: "#475569", padding: "6px 0" }}>
              Start Ollama or check Backend URL to see models
            </div>
          )}
        </div>

        <div className="settings-group">
          <label className="settings-label">Embedding Model</label>
          <input
            className="form-input"
            value={settings.embeddingModel}
            onChange={(e) => handleChange("embeddingModel", e.target.value)}
            style={{ fontSize: 12 }}
          />
        </div>

        <div className="settings-group">
          <label className="settings-label">Top K Results</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={20}
            value={settings.topK}
            onChange={(e) => handleChange("topK", parseInt(e.target.value) || 5)}
            style={{ fontSize: 12 }}
          />
        </div>

        <div className="settings-group">
          <label className="settings-label">Temperature</label>
          <input
            className="form-input"
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0.2)}
            style={{ fontSize: 12 }}
          />
        </div>

        <div className="divider" />

        <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.7 }}>
          <div style={{ marginBottom: 4, color: "#475569", fontWeight: 500 }}>Ollama Setup</div>
          <div>1. Install Ollama from <span style={{ color: "#818cf8" }}>ollama.com</span></div>
          <div>2. <code style={{ color: "#a5b4fc", fontSize: 10 }}>ollama pull qwen3:8b</code></div>
          <div>3. <code style={{ color: "#a5b4fc", fontSize: 10 }}>ollama pull nomic-embed-text</code></div>
        </div>
      </div>
    </div>
  );
}
