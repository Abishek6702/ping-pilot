import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchHistory, fetchMonitors } from "../store/slices/monitorsSlice";
import Card from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import {
  History as HistoryIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

export default function HistoryPage() {
  const dispatch = useDispatch();
  const { historyData, loading, items: monitors } = useSelector((state) => state.monitors);

  const [selectedMonitor, setSelectedMonitor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [timeRange, setTimeRange] = useState("24h");
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchMonitors());
  }, [dispatch]);

  const loadHistory = useCallback(() => {
    dispatch(
      fetchHistory({
        monitorId: selectedMonitor,
        status: selectedStatus,
        timeRange,
        page,
        limit: 30,
      })
    );
  }, [dispatch, selectedMonitor, selectedStatus, timeRange, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const results = historyData?.history || [];
  const pagination = historyData?.pagination || { page: 1, limit: 30, total: 0, pages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Monitoring History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit logs and historical ping results across all monitored endpoints (30-day retention).
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 text-xs">
          {/* Select Monitor */}
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Filter by Service
            </label>
            <select
              value={selectedMonitor}
              onChange={(e) => {
                setSelectedMonitor(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="">All Services</option>
              {monitors.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Status */}
          <div className="w-full sm:w-auto min-w-[130px]">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Result Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="UP">Success (UP)</option>
              <option value="DOWN">Failure (DOWN)</option>
            </select>
          </div>

          {/* Time range */}
          <div className="w-full sm:w-auto min-w-[130px]">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Time Window
            </label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>
          </div>
        </div>
      </Card>

      {/* History Table */}
      <Card className="overflow-hidden">
        {loading && results.length === 0 ? (
          <TableSkeleton rows={8} cols={6} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No history logs found"
            description="No check results matching the specified filters were found in the last 30 days."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                      {log.monitorId?.name || "Deleted Service"}
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
                    <td className="py-3 px-4 max-w-xs truncate">
                      {log.errorMessage ? (
                        <span className="text-rose-500">{log.errorMessage}</span>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Success
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {pagination.pages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page <span className="font-medium text-slate-900 dark:text-white">{page}</span>{" "}
              of <span className="font-medium text-slate-900 dark:text-white">{pagination.pages}</span>{" "}
              ({pagination.total} total logs)
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
        )}
      </Card>
    </div>
  );
}
