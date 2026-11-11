import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import {
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Edit2,
  Trash2,
  Clock,
  ArrowUpRight,
} from "lucide-react";

export default function MonitorTable({
  monitors = [],
  onPing,
  onEdit,
  onToggle,
  onDelete,
  pingingId = null,
}) {
  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-4">Service</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Interval</th>
            <th className="py-3 px-4">Response Time</th>
            <th className="py-3 px-4">Uptime</th>
            <th className="py-3 px-4">Last Checked</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
          {monitors.map((m) => {
            const isPinging = pingingId === m._id;
            return (
              <tr
                key={m._id}
                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                {/* Service Name & URL */}
                <td className="py-3.5 px-4">
                  <div className="flex flex-col">
                    <Link
                      to={`/monitors/${m._id}`}
                      className="font-medium text-slate-900 dark:text-white hover:text-[#0E7A88] dark:hover:text-[#38b2ac] flex items-center gap-1.5 transition-colors"
                    >
                      {m.name}
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 truncate max-w-xs flex items-center gap-1 mt-0.5"
                    >
                      {m.url}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4">
                  <StatusBadge status={m.currentStatus} />
                </td>

                {/* Interval */}
                <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Every {m.monitoringInterval ?? m.interval ?? 5} min
                  </span>
                </td>

                {/* Response Time */}
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {m.lastResponseTime !== null && m.lastResponseTime !== undefined ? (
                    <span>{m.lastResponseTime} ms</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                {/* Uptime % */}
                <td className="py-3.5 px-4">
                  {m.uptimePercentage !== null && m.uptimePercentage !== undefined ? (
                    <span
                      className={`font-semibold ${
                        m.uptimePercentage >= 99
                          ? "text-emerald-600 dark:text-emerald-400"
                          : m.uptimePercentage >= 95
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {m.uptimePercentage}%
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">
                      {m.isActive ? "No Data" : "Paused"}
                    </span>
                  )}
                </td>

                {/* Last Checked */}
                <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(m.lastCheckedAt)}</span>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Manual ping */}
                    <button
                      type="button"
                      onClick={() => onPing(m._id)}
                      disabled={isPinging}
                      title="Ping Now"
                      className="p-1.5 text-slate-500 hover:text-[#0E7A88] dark:text-slate-400 dark:hover:text-[#38b2ac] hover:bg-[#e8f7f8] dark:hover:bg-[#0E7A88]/20 rounded-md transition-colors cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isPinging ? "animate-spin text-[#0E7A88]" : ""}`}
                      />
                    </button>

                    {/* Toggle pause/resume */}
                    <button
                      type="button"
                      onClick={() => onToggle(m._id)}
                      title={m.isActive ? "Pause Monitor" : "Resume Monitor"}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        m.isActive
                          ? "text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                          : "text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50"
                      }`}
                    >
                      {m.isActive ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => onEdit(m)}
                      title="Edit Monitor"
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDelete(m)}
                      title="Delete Monitor"
                      className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

