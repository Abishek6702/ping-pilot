import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import EmptyState from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  Eye,
  Mail,
  Send,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  API_URL,
  getHeaders,
  formatDurationMs,
  formatDateTime,
} from "../utils/formatters";

const INCIDENT_STAGES = [
  "Detected",
  "Investigating",
  "Identified",
  "Monitoring",
  "Resolved",
];

const STAGE_STYLES = {
  Detected:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900",
  Investigating:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900",
  Identified:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-400 dark:border-orange-900",
  Monitoring:
    "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-400 dark:border-cyan-900",
  Resolved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900",
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [summary, setSummary] = useState({
    activeCount: 0,
    resolvedCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [monitorId, setMonitorId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Selected Incident Modal
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editStatus, setEditStatus] = useState("Detected");
  const [editNote, setEditNote] = useState("");
  const [editResolutionNotes, setEditResolutionNotes] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  const fetchMonitorsList = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/monitors?limit=100`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMonitors(json.data);
      }
    } catch {
      // Non-blocking for filter dropdown
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (monitorId) params.set("monitorId", monitorId);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (activeFilter === "active") params.set("activeOnly", "true");
      if (activeFilter === "resolved") params.set("activeOnly", "false");
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        params.set("endDate", endD.toISOString());
      }
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API_URL}/incidents?${params.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load incidents");
      }
      setIncidents(json.data || []);
      setSummary(
        json.summary || { activeCount: 0, resolvedCount: 0, totalCount: 0 }
      );
      setTotalPages(json.totalPages || 1);
    } catch (err) {
      setError(err.message || "Unable to fetch incidents");
    } finally {
      setLoading(false);
    }
  }, [page, monitorId, statusFilter, activeFilter, startDate, endDate, search]);

  useEffect(() => {
    fetchMonitorsList();
  }, [fetchMonitorsList]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const openIncidentDetail = async (id) => {
    setSelectedIncidentId(id);
    setDetailData(null);
    setDetailLoading(true);
    setEditNote("");
    try {
      const res = await fetch(`${API_URL}/incidents/${id}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to fetch incident details");
      }
      setDetailData(json.data);
      setEditStatus(json.data.status || "Detected");
      setEditResolutionNotes(json.data.resolutionNotes || "");
    } catch (err) {
      toast.error(err.message || "Failed to open incident details");
      setSelectedIncidentId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateIncident = async (e) => {
    e.preventDefault();
    if (!selectedIncidentId) return;
    setSavingUpdate(true);
    try {
      const payload = {
        status: editStatus,
        resolutionNotes: editResolutionNotes,
      };
      if (editNote.trim()) {
        payload.note = editNote.trim();
      }
      const res = await fetch(`${API_URL}/incidents/${selectedIncidentId}`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update incident");
      }
      toast.success("Incident timeline updated");
      setEditNote("");
      await openIncidentDetail(selectedIncidentId);
      fetchIncidents();
    } catch (err) {
      toast.error(err.message || "Could not update incident");
    } finally {
      setSavingUpdate(false);
    }
  };

  const resetFilters = () => {
    setMonitorId("");
    setStatusFilter("ALL");
    setActiveFilter("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Incident Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated outage detection, response workflow tracking, and recovery verification.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchIncidents}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Outages
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {summary.activeCount}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Resolved Incidents
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {summary.resolvedCount}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Recorded
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {summary.totalCount}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#e8f7f8] dark:bg-[#0E7A88]/20 flex items-center justify-center text-[#0E7A88] dark:text-[#38b2ac]">
            <Activity className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search key (INC-...) or title..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
            />
          </div>

          <select
            value={monitorId}
            onChange={(e) => {
              setMonitorId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
          >
            <option value="">All Monitors</option>
            {monitors.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
          >
            <option value="ALL">All Stages</option>
            {INCIDENT_STAGES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
          >
            <option value="all">Active & Resolved</option>
            <option value="active">Active Only</option>
            <option value="resolved">Resolved Only</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Failed to load incidents
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
          <button
            type="button"
            onClick={fetchIncidents}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white hover:bg-[#0a5f6a] transition-colors"
          >
            Try Again
          </button>
        </Card>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No Incidents Found"
          description="No outages match your current filters. Services appear healthy or have not recorded incidents in this window."
          actionLabel="Clear Filters"
          onAction={resetFilters}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Incident</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Checks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {incidents.map((inc) => {
                  const badgeStyle =
                    STAGE_STYLES[inc.status] || STAGE_STYLES.Detected;
                  return (
                    <tr
                      key={inc._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-semibold text-[#0E7A88] dark:text-[#38b2ac]">
                          {inc.incidentKey}
                        </div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                          {inc.title}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {inc.monitorId?._id ? (
                          <Link
                            to={`/monitors/${inc.monitorId._id}`}
                            className="font-medium text-slate-800 dark:text-slate-200 hover:text-[#0E7A88] transition-colors"
                          >
                            {inc.monitorId.name}
                          </Link>
                        ) : (
                          <span className="text-slate-500">Deleted Monitor</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}
                        >
                          {inc.isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          )}
                          {inc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div>{formatDateTime(inc.startedAt)}</div>
                        <div className="text-slate-400">
                          {inc.resolvedAt
                            ? `Resolved: ${formatDateTime(inc.resolvedAt)}`
                            : "Ongoing"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDurationMs(inc.liveDurationMs)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {inc.affectedChecksCount || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openIncidentDetail(inc._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-[#0E7A88] hover:text-white transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Incident Detail & Lifecycle Modal */}
      <Modal
        isOpen={Boolean(selectedIncidentId)}
        onClose={() => setSelectedIncidentId(null)}
        title={
          detailData
            ? `${detailData.incidentKey} — ${detailData.title}`
            : "Incident Details"
        }
        maxWidth="max-w-3xl"
      >
        {detailLoading || !detailData ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Loading incident timeline and affected checks...
          </div>
        ) : (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Meta summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl text-xs">
              <div>
                <p className="text-slate-500">Current Stage</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {detailData.status}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Started</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatDateTime(detailData.startedAt)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Resolved</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {detailData.resolvedAt
                    ? formatDateTime(detailData.resolvedAt)
                    : "Active Outage"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Downtime Duration</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatDurationMs(detailData.liveDurationMs)}
                </p>
              </div>
            </div>

            {detailData.description && (
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                {detailData.description}
              </p>
            )}

            {/* Update Lifecycle Form */}
            <form
              onSubmit={handleUpdateIncident}
              className="space-y-3 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Update Stage & Resolution Notes
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Lifecycle Stage
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {INCIDENT_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Timeline Update Note
                  </label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="e.g., Identified upstream DNS timeout..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Resolution / Root Cause Notes
                </label>
                <textarea
                  rows={2}
                  value={editResolutionNotes}
                  onChange={(e) => setEditResolutionNotes(e.target.value)}
                  placeholder="Document mitigation or post-mortem notes..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingUpdate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white hover:bg-[#0a5f6a] disabled:opacity-60 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {savingUpdate ? "Saving..." : "Update Incident"}
                </button>
              </div>
            </form>

            {/* Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Incident Timeline
              </h4>
              <div className="space-y-3 border-l-2 border-slate-200 dark:border-slate-700 pl-4 ml-1">
                {(detailData.timeline || []).map((entry, idx) => (
                  <div key={idx} className="relative">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0E7A88] absolute -left-[21px] top-1.5 ring-4 ring-white dark:ring-slate-900" />
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold border ${
                          STAGE_STYLES[entry.status] || STAGE_STYLES.Detected
                        }`}
                      >
                        {entry.status}
                      </span>
                      <span className="text-slate-500">
                        {entry.actorName || "System"}
                      </span>
                      <span className="text-slate-400">
                        {formatDateTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {entry.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification Logs */}
            {Array.isArray(detailData.notifications) &&
              detailData.notifications.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Email Notification Delivery Log
                  </h4>
                  <div className="space-y-2">
                    {detailData.notifications.map((n) => (
                      <div
                        key={n._id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{n.type}</span>
                          <span className="text-slate-500">{n.recipientEmail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              n.status === "SENT"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {n.status} ({n.attempts} try)
                          </span>
                          {n.lastError && (
                            <span className="text-rose-500">{n.lastError}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Affected Pings */}
            {Array.isArray(detailData.affectedPings) &&
              detailData.affectedPings.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Affected Monitoring Checks ({detailData.affectedPings.length})
                  </h4>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {detailData.affectedPings.map((ping) => (
                      <div
                        key={ping._id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="font-semibold text-rose-600">
                          {ping.status} {ping.statusCode ? `(${ping.statusCode})` : ""}
                        </span>
                        <span className="text-slate-500 truncate max-w-xs">
                          {ping.errorMessage || "Request failed"}
                        </span>
                        <span className="text-slate-400">
                          {ping.responseTime}ms • {formatDateTime(ping.checkedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}

