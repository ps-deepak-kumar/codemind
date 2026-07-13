"use client";

import { CheckCircle, XCircle, Info } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface Props {
  toasts: Toast[];
}

export default function ToastContainer({ toasts }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type} fade-in`}>
          {toast.type === "success" && <CheckCircle size={14} />}
          {toast.type === "error" && <XCircle size={14} />}
          {toast.type === "info" && <Info size={14} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
