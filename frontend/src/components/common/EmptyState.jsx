import React from "react";
import { Activity } from "lucide-react";

export default function EmptyState({
  icon: Icon = Activity,
  title = "No data found",
  description = "Get started by adding your first monitor.",
  action,
  actionLabel,
  onAction,
}) {
  const renderedAction =
    action ||
    (actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white hover:bg-[#0a5f6a] transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    ) : null);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-medium text-slate-800 dark:text-slate-200 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {renderedAction && <div>{renderedAction}</div>}
    </div>
  );
}
