import React from "react";
import { Link } from "react-router-dom";
import Card from "../common/Card";
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

const formatDate = (dateString) => {
  if (!dateString) return "Never";
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const renderIntervalBadge = (m) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
    Every {m.monitoringInterval ?? m.interval ?? 5} min
  </span>
);

const renderResponseTime = (m) =>
  m.lastResponseTime !== null && m.lastResponseTime !== undefined ? (
    <span>{m.lastResponseTime} ms</span>
  ) : (
    <span className="text-slate-400">—</span>
  );

const renderUptime = (m) =>
  m.uptimePercentage !== null && m.uptimePercentage !== undefined ? (
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
  );

export default function MonitorTable({
  monitors = [],
  viewMode = "table",
  gridClassName = "",
  onPing,
  onEdit,
  onToggle,
  onDelete,
  pingingId = null,
}) {
  const renderActionButtons = (m) => {
    const isPinging = pingingId === m._id;
    return (
      <div className="flex items-center justify-end gap-1.5">
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
          {m.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => onEdit(m)}
          title="Edit Monitor"
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(m)}
          title="Delete Monitor"
          className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  if (viewMode === "grid") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 ${gridClassName}`}>
        {monitors.map((m) => (
          <Card key={m._id} hover className="p-4 flex flex-col justify-between gap-3">
            {/* Header: Name, URL, Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/monitors/${m._id}`}
                  className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#0E7A88] dark:hover:text-[#38b2ac] inline-flex items-center gap-1 transition-colors max-w-full"
                >
                  <span className="truncate">{m.name}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 mt-0.5 truncate"
                >
                  <span className="truncate">{m.url}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              </div>
              <StatusBadge status={m.currentStatus} size="sm" />
            </div>

            {/* Metrics 2x2 Summary */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Interval
                </p>
                {renderIntervalBadge(m)}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Response
                </p>
                <p className="font-mono font-medium text-slate-700 dark:text-slate-200">
                  {renderResponseTime(m)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Uptime
                </p>
                <div>{renderUptime(m)}</div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Last Checked
                </p>
                <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{formatDate(m.lastCheckedAt)}</span>
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link
                to={`/monitors/${m._id}`}
                className="text-xs font-medium text-[#0E7A88] dark:text-[#38b2ac] hover:underline"
              >
                View details
              </Link>
              {renderActionButtons(m)}
            </div>
          </Card>
        ))}
      </div>
    );
  }

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
          {monitors.map((m) => (
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
                {renderIntervalBadge(m)}
              </td>

              {/* Response Time */}
              <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                {renderResponseTime(m)}
              </td>

              {/* Uptime % */}
              <td className="py-3.5 px-4">{renderUptime(m)}</td>

              {/* Last Checked */}
              <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{formatDate(m.lastCheckedAt)}</span>
                </div>
              </td>

              {/* Actions */}
              <td className="py-3.5 px-4 text-right">{renderActionButtons(m)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
