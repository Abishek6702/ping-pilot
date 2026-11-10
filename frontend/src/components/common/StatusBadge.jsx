import React from "react";

export default function StatusBadge({ status, size = "md", showDot = true }) {
  const normalized = (status || "UNKNOWN").toUpperCase();

  const config = {
    UP: {
      label: "Operational",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800/60",
      dot: "bg-emerald-500",
    },
    DOWN: {
      label: "Down",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-400",
      border: "border-rose-200 dark:border-rose-800/60",
      dot: "bg-rose-500",
    },
    PAUSED: {
      label: "Paused",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800/60",
      dot: "bg-amber-500",
    },
    UNKNOWN: {
      label: "Unknown",
      bg: "bg-slate-100 dark:bg-slate-800/60",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-700",
      dot: "bg-slate-400",
    },
  };

  const style = config[normalized] || config.UNKNOWN;
  const sizeClasses =
    size === "sm"
      ? "text-xs px-2 py-0.5 gap-1.5"
      : size === "lg"
      ? "text-sm px-3 py-1 gap-2"
      : "text-xs px-2.5 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${style.dot} ${
            normalized === "UP" ? "animate-pulse-dot" : ""
          }`}
        />
      )}
      {style.label}
    </span>
  );
}

