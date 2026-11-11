import React from "react";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  LayoutDashboard,
  Activity,
  History,
  Settings,
  Sparkles,
  Users,
  ShieldCheck,
  FileText,
  X,
  Radio,
} from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useSelector((state) => state.auth);

  const navItems = [
    { name: "Overview", to: "/", icon: LayoutDashboard },
    { name: "Monitors", to: "/monitors", icon: Activity },
    { name: "Monitoring History", to: "/history", icon: History },
    { name: "API Tester", to: "/tester", icon: Sparkles },
    { name: "Settings", to: "/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <NavLink to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0E7A88] flex items-center justify-center text-white shadow-xs">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                Ping<span className="text-[#0E7A88]">Pilot</span>
              </span>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 lg:hidden rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#e8f7f8] text-[#0E7A88] dark:bg-[#0E7A88]/20 dark:text-[#38b2ac] shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          {user?.role === "admin" && (
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0E7A88]" />
                Administration
              </div>
              <NavLink
                to="/admin/users"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#e8f7f8] text-[#0E7A88] dark:bg-[#0E7A88]/20 dark:text-[#38b2ac] shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                  }`
                }
              >
                <Users className="w-4 h-4 shrink-0 text-[#0E7A88]" />
                <span>Users & Platform</span>
              </NavLink>

              <NavLink
                to="/admin/audit-logs"
                onClick={onClose}
                className={({ isActive }) =>
                  `mt-1 flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#e8f7f8] text-[#0E7A88] dark:bg-[#0E7A88]/20 dark:text-[#38b2ac] shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                  }`
                }
              >
                <FileText className="w-4 h-4 shrink-0 text-[#0E7A88]" />
                <span>Audit Logs</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Footer info card */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Keep-Alive Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Per-monitor interval checks via GitHub Actions
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
