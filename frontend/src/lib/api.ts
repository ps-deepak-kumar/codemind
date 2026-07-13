export let API_BASE_URL = "http://localhost:8000/api/v1";

if (typeof window !== "undefined") {
  const customUrl = localStorage.getItem("codemind_api_url");
  if (customUrl) {
    API_BASE_URL = customUrl;
  } else if (process.env.NEXT_PUBLIC_API_URL) {
    API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  }
}

export interface Repository {
  id: number;
  name: string;
  url: string;
  path: string;
  size: number;
  status: "cloning" | "parsing" | "indexing" | "ready" | "error";
  error_message?: string;
  total_files: number;
  indexed_files: number;
  total_chunks: number;
  languages: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface FileRecord {
  id: number;
  repository_id: number;
  path: string;
  language?: string;
  size: number;
  indexed: boolean;
}

export interface RepoDetail {
  repository: Repository;
  files: FileRecord[];
}

export interface SourceNode {
  file_path: string;
  language?: string;
  chunk_type: string;
  name?: string;
  start_line: number;
  end_line: number;
  content: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceNode[];
}

export interface StreamEvent {
  type: "sources" | "token" | "done";
  sources?: SourceNode[];
  content?: string;
}

export interface Settings {
  current: {
    llm_model: string;
    embedding_model: string;
    ollama_url: string;
  };
  available_models: string[];
}

// ---- Repository Endpoints ----
export async function listRepositories(): Promise<Repository[]> {
  const res = await fetch(`${API_BASE_URL}/repos/`);
  if (!res.ok) throw new Error("Failed to list repositories");
  return res.json();
}

export async function addRepository(url: string): Promise<Repository> {
  const res = await fetch(`${API_BASE_URL}/repos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to add repository");
  }
  return res.json();
}

export async function getRepository(id: number): Promise<RepoDetail> {
  const res = await fetch(`${API_BASE_URL}/repos/${id}`);
  if (!res.ok) throw new Error("Failed to get repository details");
  return res.json();
}

export async function deleteRepository(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/repos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete repository");
}

export async function refreshRepository(id: number): Promise<Repository> {
  const res = await fetch(`${API_BASE_URL}/repos/${id}/refresh`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to refresh repository");
  return res.json();
}

// ---- Chat Endpoints ----
export async function* streamChat(
  repositoryId: number,
  query: string,
  llmModel?: string,
  topK?: number,
  temperature?: number,
  mode?: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repository_id: repositoryId,
      query,
      llm_model: llmModel,
      top_k: topK || 5,
      temperature: temperature || 0.2,
      mode: mode || "default",
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    yield { type: "token", content: "Error: Failed to connect to the backend." };
    yield { type: "done" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const eventData: StreamEvent = JSON.parse(line.slice(6));
          yield eventData;
        } catch {}
      }
    }
  }
}

// ---- Settings Endpoints ----
export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE_URL}/settings/`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function getFileContent(repoId: number, path: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/repos/${repoId}/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error("Failed to get file content");
  const data = await res.json();
  return data.content;
}

