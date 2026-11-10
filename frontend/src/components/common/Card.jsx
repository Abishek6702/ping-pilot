import React from "react";

export default function Card({ children, className = "", hover = false, ...props }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs ${
        hover
          ? "transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

