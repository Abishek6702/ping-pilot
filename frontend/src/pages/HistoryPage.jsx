import React, { useEffect, useState, useCallback } from "react";
import Card from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import ViewModeToggle from "../components/common/ViewModeToggle";
import { GridSkeleton, TableSkeleton } from "../components/common/Skeleton";
import useViewMode from "../hooks/useViewMode";
import {
  History as HistoryIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Layers,
  X,
  Clock,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

const getHeaders = () => {
  const token = localStorage.getItem("pingpilot_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function HistoryPage() {
  const [monitors, setMonitors] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedMonitor, setSelectedMonitor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [timeRange, setTimeRange] = useState("24h");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useViewMode();

  // Direct fetch for monitor list (for dropdown filter)
  const loadMonitors = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/monitors?limit=100`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMonitors(data.monitors || []);
      }
    } catch (err) {
      console.error("Failed to load monitors filter list:", err);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  // Direct fetch for history audit logs
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedMonitor) query.append("monitorId", selectedMonitor);
      if (selectedStatus && selectedStatus !== "ALL") query.append("status", selectedStatus);
      if (timeRange) query.append("timeRange", timeRange);
      query.append("page", page.toString());
      query.append("limit", "30");

      const res = await fetch(`${API_URL}/history?${query.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setHistoryData(data);
      } else {
        toast.error(data.error || "Failed to load history");
      }
    } catch (err) {
      toast.error(err.message || "Failed to fetch history logs");
    } finally {
      setLoading(false);
    }
  }, [selectedMonitor, selectedStatus, timeRange, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const results = historyData?.history || [];
  const pagination = historyData?.pagination || { page: 1, limit: 30, total: 0, pages: 1 };

  const currentSelectedMonitorObj = monitors.find((m) => m._id === selectedMonitor);
  const hasActiveFilters = selectedMonitor !== "" || selectedStatus !== "ALL" || timeRange !== "24h";

  const handleClearFilters = () => {
    setSelectedMonitor("");
    setSelectedStatus("ALL");
    setTimeRange("24h");
    setPage(1);
  };

  const renderServiceButton = (log, className = "") => (
    <button
      type="button"
      onClick={() => {
        if (log.monitorId?._id) {
          setSelectedMonitor(log.monitorId._id);
          setPage(1);
        }
      }}
      className={`hover:text-[#0E7A88] dark:hover:text-[#38b2ac] hover:underline cursor-pointer text-left font-semibold ${className}`}
      title="Click to filter by this service"
    >
      {log.monitorId?.name || "Deleted Service"}
    </button>
  );

  const renderOutcome = (log) =>
    log.errorMessage ? (
      <span className="text-rose-500 break-words">{log.errorMessage}</span>
    ) : (
      <span className="text-emerald-500 flex items-center gap-1 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Success
      </span>
    );

  const paginationControls =
    pagination.pages > 1 ? (
      <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Showing page <span className="font-medium text-slate-900 dark:text-white">{page}</span> of{" "}
          <span className="font-medium text-slate-900 dark:text-white">{pagination.pages}</span> (
          {pagination.total} total logs)
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page >= pagination.pages}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Monitoring History
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0E7A88]/10 text-[#0E7A88]">
              {pagination.total || 0} checks
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time audit logs and historical ping results across your services (30-day retention).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={loadHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0E7A88]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* 1. Service Dropdown Filter */}
            <div className="w-full sm:w-auto min-w-[220px]">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#0E7A88]" />
                <span>Filter by Service</span>
              </label>
              <select
                value={selectedMonitor}
                onChange={(e) => {
                  setSelectedMonitor(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="">All Services ({monitors.length})</option>
                {monitors.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.currentStatus || "UP"})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Status Dropdown Filter */}
            <div className="w-full sm:w-auto min-w-[140px]">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#0E7A88]" />
                <span>Result Status</span>
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="UP">Success (UP)</option>
                <option value="DOWN">Failure (DOWN)</option>
              </select>
            </div>

            {/* 3. Time Window Filter */}
            <div className="w-full sm:w-auto min-w-[140px]">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#0E7A88]" />
                <span>Time Window</span>
              </label>
              <select
                value={timeRange}
                onChange={(e) => {
                  setTimeRange(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="24h">Past 24 Hours</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
              </select>
            </div>
          </div>

          {/* Active Filter Badges & Reset Button */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 self-start lg:self-end">
              {currentSelectedMonitorObj && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0E7A88]/10 text-[#0E7A88]">
                  <span>Service: {currentSelectedMonitorObj.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMonitor("")}
                    className="hover:opacity-75 cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <span>Status: {selectedStatus}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("ALL")}
                    className="hover:opacity-75 cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold underline cursor-pointer pl-1"
              >
                Reset All
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* History List / Table */}
      {loading && results.length === 0 ? (
        viewMode === "grid" ? (
          <GridSkeleton count={6} />
        ) : (
          <Card className="overflow-hidden p-4">
            <TableSkeleton rows={8} cols={6} />
          </Card>
        )
      ) : results.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={HistoryIcon}
            title={selectedMonitor ? "No logs for this service" : "No history logs found"}
            description={
              selectedMonitor
                ? `No check results were found for "${currentSelectedMonitorObj?.name || "selected service"}" in the selected time range.`
                : "No check results matching the specified filters were found in the last 30 days."
            }
          />
        </Card>
      ) : viewMode === "grid" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((log) => (
              <Card key={log._id} hover className="p-4 flex flex-col justify-between gap-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {renderServiceButton(
                      log,
                      "text-sm text-slate-900 dark:text-white truncate block max-w-full"
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(log.checkedAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={log.status} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      HTTP Status
                    </p>
                    <p className="font-mono font-medium text-slate-700 dark:text-slate-200">
                      {log.statusCode ? `HTTP ${log.statusCode}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      Latency
                    </p>
                    <p className="font-mono font-medium text-slate-700 dark:text-slate-200">
                      {log.responseTime} ms
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  {renderOutcome(log)}
                </div>
              </Card>
            ))}
          </div>

          {paginationControls && <Card className="overflow-hidden">{paginationControls}</Card>}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">HTTP Status</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {results.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {renderServiceButton(log)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {log.statusCode ? `HTTP ${log.statusCode}` : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {log.responseTime} ms
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(log.checkedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">{renderOutcome(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginationControls}
        </Card>
      )}
    </div>
  );
}
