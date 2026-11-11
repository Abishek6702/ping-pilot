import React from "react";
import { LayoutGrid, Table as TableIcon } from "lucide-react";

const VIEW_OPTIONS = [
  { id: "grid", label: "Grid", icon: LayoutGrid },
  { id: "table", label: "Table", icon: TableIcon },
];

export default function ViewModeToggle({ viewMode, onChange, className = "" }) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs shrink-0 ${className}`}
    >
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = viewMode === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            title={`${option.label} view`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-white dark:bg-slate-900 text-[#0E7A88] dark:text-[#38b2ac] shadow-2xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

