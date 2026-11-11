import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import ViewModeToggle from "../components/common/ViewModeToggle";
import { GridSkeleton, TableSkeleton } from "../components/common/Skeleton";
import useViewMode from "../hooks/useViewMode";
import {
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
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

const METHOD_BADGE_STYLES = {
  GET: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-900/60",
  POST: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60",
  PATCH: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900/60",
  PUT: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60",
  DELETE: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-900/60",
};

const renderMethodBadge = (method) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
      METHOD_BADGE_STYLES[method] ||
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
    }`}
  >
    {method}
  </span>
);

const renderAuditStatusBadge = (log) =>
  log.success ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
      <CheckCircle2 className="w-3 h-3" />
      {log.statusCode} OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
      <XCircle className="w-3 h-3" />
      {log.statusCode} Fail
    </span>
  );

export default function AdminAuditLogsPage() {
  const { user } = useSelector((state) => state.auth);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [successFilter, setSuccessFilter] = useState("ALL");
  const [viewMode, setViewMode] = useViewMode();

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.append("page", page.toString());
      query.append("limit", "20");
      if (methodFilter !== "ALL") query.append("method", methodFilter);
      if (successFilter !== "ALL") query.append("success", successFilter);
      if (search.trim()) query.append("search", search.trim());

      const res = await fetch(`${API_URL}/admin/audit-logs?${query.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
      } else {
        toast.error(data.error || "Failed to load audit logs");
      }
    } catch (err) {
      toast.error(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, methodFilter, successFilter, search]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const paginationBar =
    pagination.pages > 1 ? (
      <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Showing page <span className="font-medium text-slate-900 dark:text-white">{page}</span> of{" "}
          <span className="font-medium text-slate-900 dark:text-white">{pagination.pages}</span> (
          {pagination.total} total events)
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0E7A88]/10 text-[#0E7A88]">
              {pagination.total || 0} events
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Platform-wide API request trail, actor roles, response times, and client metadata.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAuditLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-sm cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0E7A88]" : ""}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filters & View Switcher */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search actor, action, endpoint, IP..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
            >
              <option value="ALL">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>

            <select
              value={successFilter}
              onChange={(e) => {
                setSuccessFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
            >
              <option value="ALL">All Outcomes</option>
              <option value="true">Success (&lt; 400)</option>
              <option value="false">Failed (&gt;= 400)</option>
            </select>
          </div>

          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} className="self-start lg:self-auto" />
        </div>
      </Card>

      {/* Audit Logs List / Table */}
      {loading && logs.length === 0 ? (
        viewMode === "grid" ? (
          <GridSkeleton count={6} />
        ) : (
          <Card className="overflow-hidden p-4">
            <TableSkeleton rows={8} cols={7} />
          </Card>
        )
      ) : logs.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={FileText}
            title="No audit log entries found"
            description="API requests matching your search criteria or filters will appear here."
          />
        </Card>
      ) : viewMode === "grid" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {logs.map((log) => (
              <Card key={log._id} hover className="p-4 flex flex-col justify-between gap-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {log.action || `${log.method} ${log.endpoint}`}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                      {log.endpoint}
                    </p>
                  </div>
                  {renderMethodBadge(log.method)}
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      Actor
                    </p>
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {log.name || "Anonymous"}{" "}
                      <span className="text-[10px] text-slate-400">({log.role || "Guest"})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      Result
                    </p>
                    {renderAuditStatusBadge(log)}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      Latency
                    </p>
                    <p className="font-mono text-slate-700 dark:text-slate-200">
                      {log.responseTime !== null && log.responseTime !== undefined
                        ? `${log.responseTime} ms`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      IP Address
                    </p>
                    <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {log.ipAddress || "—"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span className="truncate max-w-[55%]" title={log.userAgent || ""}>
                    {log.userAgent || "Unknown client"}
                  </span>
                  <span className="shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </Card>
            ))}
          </div>

          {paginationBar && <Card className="overflow-hidden">{paginationBar}</Card>}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Endpoint</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {log.name || "Anonymous"}
                        </p>
                        <p className="text-[11px] text-slate-400 capitalize">
                          {log.role || "Guest"}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {log.action || "—"}
                    </td>
                    <td className="py-3 px-4">{renderMethodBadge(log.method)}</td>
                    <td
                      className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-w-xs truncate"
                      title={log.userAgent || log.endpoint}
                    >
                      {log.endpoint}
                    </td>
                    <td className="py-3 px-4">{renderAuditStatusBadge(log)}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {log.responseTime !== null && log.responseTime !== undefined
                        ? `${log.responseTime} ms`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.ipAddress || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginationBar}
        </Card>
      )}
    </div>
  );
}

