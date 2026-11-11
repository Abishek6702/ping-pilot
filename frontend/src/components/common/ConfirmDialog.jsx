import React from "react";
import Modal from "./Modal";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText,
  confirmLabel,
  confirmVariant = "danger",
  isDanger = false,
  loading = false,
}) {
  const handleClose = onClose || onCancel || (() => {});
  const resolvedVariant = isDanger ? "danger" : confirmVariant;
  const resolvedLabel = confirmText || confirmLabel || "Delete";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="max-w-md">
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`p-3 rounded-full shrink-0 ${
            resolvedVariant === "danger"
              ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
              : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
          }`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            resolvedVariant === "danger"
              ? "bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              : "bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
          }`}
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {resolvedLabel}
        </button>
      </div>
    </Modal>
  );
}
