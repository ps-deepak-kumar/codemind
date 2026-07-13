import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    Python: "#3572A5",
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Go: "#00ADD8",
    Java: "#b07219",
    "C++": "#f34b7d",
    Ruby: "#701516",
    Rust: "#dea584",
    Default: "#6366f1",
  };
  return colors[language] || colors["Default"];
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "ready": return "text-emerald-400";
    case "cloning": return "text-blue-400";
    case "parsing": return "text-amber-400";
    case "indexing": return "text-purple-400";
    case "error": return "text-red-400";
    default: return "text-gray-400";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "ready": return "Ready";
    case "cloning": return "Cloning...";
    case "parsing": return "Parsing...";
    case "indexing": return "Indexing...";
    case "error": return "Error";
    default: return "Unknown";
  }
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
