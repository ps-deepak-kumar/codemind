"use client";

import { useState, useEffect, useRef } from "react";
import {
  FolderOpen, FileCode2, Circle, DatabaseZap,
  Layers, FileText, RefreshCw, AlertCircle,
} from "lucide-react";
import { Repository, RepoDetail, getRepository, FileRecord, getFileContent } from "@/lib/api";
import { formatBytes, getLanguageColor } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  selectedRepo: Repository | null;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
  activeFile: { path: string; highlightLines?: [number, number] } | null;
  setActiveFile: (f: { path: string; highlightLines?: [number, number] } | null) => void;
  onSelectFile: (path: string, highlightLines?: [number, number]) => void;
}

const SKELETON_WIDTHS = [75, 85, 60, 90, 70, 50, 80, 65, 85, 70, 90, 55, 80, 75, 60];

export default function RepoExplorer({ selectedRepo, onToast, activeFile, setActiveFile, onSelectFile }: Props) {
  const [detail, setDetail] = useState<RepoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Fetch file content when activeFile changes
  useEffect(() => {
    if (!activeFile || !selectedRepo) {
      setFileContent("");
      setFileError(null);
      return;
    }
    setFileLoading(true);
    setFileError(null);
    getFileContent(selectedRepo.id, activeFile.path)
      .then((content) => {
        setFileContent(content);
      })
      .catch((err) => {
        setFileError(err.message || "Failed to load file content");
      })
      .finally(() => {
        setFileLoading(false);
      });
  }, [activeFile?.path, selectedRepo?.id]);

  useEffect(() => {
    if (!selectedRepo) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getRepository(selectedRepo.id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRepo]);

  if (!selectedRepo) {
    return (
      <main className="explorer">
        <div className="empty-state" style={{ height: "100%" }}>
          <div className="empty-state-icon">
            <FolderOpen size={28} color="#4f46e5" />
          </div>
          <div className="empty-title">No repository selected</div>
          <div className="empty-desc">
            Select a repository from the sidebar or add a new GitHub repository to explore its code.
          </div>
        </div>
      </main>
    );
  }

  const repo = detail?.repository || selectedRepo;
  const files = detail?.files || [];
  const isProcessing = ["cloning", "parsing", "indexing"].includes(repo.status);

  const filteredFiles = searchQuery
    ? files.filter((f) => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  // Group files by top-level directory
  const grouped: Record<string, FileRecord[]> = {};
  filteredFiles.forEach((f) => {
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts[0] : "(root)";
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  });

  // Language bar segments
  const langEntries = Object.entries(repo.languages || {}).sort((a, b) => b[1] - a[1]);

  const activeFileRecord = files.find((f) => f.path === activeFile?.path);
  const fileLanguage = activeFileRecord?.language ? activeFileRecord.language.toLowerCase() : "typescript";

  if (activeFile) {
    return (
      <main className="explorer fade-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header with file path and back button */}
        <div className="explorer-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              className="btn btn-ghost"
              onClick={() => setActiveFile(null)}
              style={{ padding: "4px 8px", minHeight: 0 }}
            >
              Back
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {activeFile.path.split("/").pop()}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {activeFile.path}
              </div>
            </div>
          </div>
          {activeFileRecord && (
            <span
              className="lang-badge"
              style={{
                background: getLanguageColor(activeFileRecord.language || "") + "22",
                color: getLanguageColor(activeFileRecord.language || ""),
                border: `1px solid ${getLanguageColor(activeFileRecord.language || "")}44`,
              }}
            >
              {activeFileRecord.language}
            </span>
          )}
        </div>

        {/* Code Content */}
        <div style={{ flex: 1, overflow: "hidden", background: "#0d1117", position: "relative" }}>
          {fileLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 20, borderRadius: 4, width: `${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}%` }} />
              ))}
            </div>
          ) : fileError ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", color: "#ef4444", padding: 16 }}>
              <AlertCircle size={28} />
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fileError}</div>
              <button className="btn btn-primary" onClick={() => {
                setFileLoading(true);
                getFileContent(selectedRepo.id, activeFile.path)
                  .then(setFileContent)
                  .catch((err) => setFileError(err.message))
                  .finally(() => setFileLoading(false));
              }}>
                Retry
              </button>
            </div>
          ) : (
            <CodeHighlightContainer
              content={fileContent}
              language={fileLanguage}
              highlightLines={activeFile.highlightLines}
            />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="explorer fade-in">
      {/* ---- Header ---- */}
      <div className="explorer-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
              {repo.name}
            </h2>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontFamily: "var(--font-mono)" }}>
              {repo.url}
            </div>
          </div>
          {isProcessing && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#818cf8" }}>
              <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
              {repo.status}...
            </div>
          )}
          {repo.status === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#f87171" }}>
              <AlertCircle size={12} />
              Error
            </div>
          )}
        </div>

        {/* ---- Language Bar ---- */}
        {langEntries.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="lang-bar" style={{ marginBottom: 6 }}>
              {langEntries.map(([lang, pct]) => (
                <div
                  key={lang}
                  className="lang-segment"
                  style={{
                    background: getLanguageColor(lang),
                    flex: pct,
                  }}
                  title={`${lang}: ${pct}%`}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              {langEntries.map(([lang, pct]) => (
                <div key={lang} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#94a3b8" }}>
                  <Circle size={8} fill={getLanguageColor(lang)} color={getLanguageColor(lang)} />
                  {lang} {pct}%
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Stat Cards ---- */}
        <div className="stat-grid">
          <StatCard icon={<FileCode2 size={14} />} value={repo.total_files.toLocaleString()} label="Total Files" />
          <StatCard icon={<DatabaseZap size={14} />} value={repo.indexed_files.toLocaleString()} label="Indexed" />
          <StatCard icon={<Layers size={14} />} value={repo.total_chunks.toLocaleString()} label="Chunks" />
        </div>

        <div style={{ fontSize: 10, color: "#334155", display: "flex", gap: 12 }}>
          <span>Size: <span style={{ color: "#64748b" }}>{formatBytes(repo.size)}</span></span>
        </div>
      </div>

      {/* ---- File Explorer ---- */}
      <div className="explorer-body">
        {loading ? (
          <SkeletonList />
        ) : (
          <>
            {/* Search */}
            <input
              className="form-input"
              placeholder="Search files…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: 12, fontSize: 12, padding: "7px 10px" }}
            />

            {filteredFiles.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <FileText size={28} color="#4f46e5" />
                <div className="empty-title">
                  {isProcessing ? "Indexing files…" : "No files found"}
                </div>
                {isProcessing && <div className="progress-bar" style={{ width: 120 }} />}
              </div>
            ) : (
              Object.entries(grouped).map(([dir, dirFiles]) => (
                <DirectoryGroup key={dir} dir={dir} files={dirFiles} onSelectFile={onSelectFile} />
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="stat-card">
      <div style={{ color: "#6366f1", marginBottom: 4 }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function DirectoryGroup({ dir, files, onSelectFile }: { dir: string; files: FileRecord[]; onSelectFile: (path: string) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 6,
          width: "100%",
          color: "#64748b",
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        <FolderOpen size={12} color="#6366f1" />
        {dir}
        <span style={{ color: "#334155", fontWeight: 400, marginLeft: "auto" }}>{files.length}</span>
      </button>

      {open && files.map((file) => (
        <div
          key={file.id}
          className="file-tree-item"
          onClick={() => onSelectFile(file.path)}
        >
          <FileCode2 size={12} style={{ flexShrink: 0, color: "#4f46e5" }} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.path.split("/").pop()}
          </span>
          {file.language && (
            <span
              className="lang-badge"
              style={{
                background: getLanguageColor(file.language) + "22",
                color: getLanguageColor(file.language),
                border: `1px solid ${getLanguageColor(file.language)}44`,
              }}
            >
              {file.language}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CodeHighlightContainer({
  content,
  language,
  highlightLines,
}: {
  content: string;
  language: string;
  highlightLines?: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightLines || !containerRef.current) return;
    const [start] = highlightLines;
    const targetElement = containerRef.current.querySelector(`#line-${start}`);
    if (targetElement) {
      setTimeout(() => {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [content, highlightLines]);

  return (
    <div ref={containerRef} style={{ height: "100%" }}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines
        lineProps={(lineNumber) => {
          const style: React.CSSProperties = { display: "block", width: "100%" };
          if (highlightLines && lineNumber >= highlightLines[0] && lineNumber <= highlightLines[1]) {
            style.backgroundColor = "rgba(99, 102, 241, 0.20)";
            style.borderLeft = "3px solid #6366f1";
            style.paddingLeft = "2px";
          }
          return { style, id: `line-${lineNumber}` };
        }}
        customStyle={{
          margin: 0,
          background: "#0d1117",
          fontSize: 12,
          padding: "16px 8px",
          height: "100%",
          overflow: "auto",
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 28, borderRadius: 8 }} />
      ))}
    </div>
  );
}
