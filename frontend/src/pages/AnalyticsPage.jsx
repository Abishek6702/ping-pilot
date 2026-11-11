import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import { CardSkeleton } from "../components/common/Skeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Gauge,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  API_URL,
  getHeaders,
  formatDurationMs,
  formatUptime,
  formatResponseTime,
} from "../utils/formatters";

function DeltaBadge({ delta, unit = "", inverse = false }) {
  if (delta === null || delta === undefined || delta === 0) {
    return (
      <span className="text-[11px] text-slate-400">No change vs prev</span>
    );
  }
  const positiveGood = inverse ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        positiveGood
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      }`}
    >
      <Icon className="w-3 h-3" />
      {delta > 0 ? `+${delta}` : delta}
      {unit} vs prev
    </span>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("24h");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedMonitorId, setSelectedMonitorId] = useState("");
  const [monitors, setMonitors] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMonitors = useCallback(async () => {
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
      // ignore dropdown error
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (range === "custom" && (!customStart || !customEnd)) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ range });
      if (range === "custom") {
        params.set("startDate", new Date(customStart).toISOString());
        const endDateObj = new Date(customEnd);
        endDateObj.setHours(23, 59, 59, 999);
        params.set("endDate", endDateObj.toISOString());
      }
      if (selectedMonitorId) {
        params.set("monitorId", selectedMonitorId);
      }

      const res = await fetch(`${API_URL}/analytics?${params.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load analytics");
      }
      setData(json.data);
    } catch (err) {
      setError(err.message || "Unable to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd, selectedMonitorId]);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  useEffect(() => {
    if (range !== "custom" || (customStart && customEnd)) {
      fetchAnalytics();
    }
  }, [range, selectedMonitorId, fetchAnalytics, customStart, customEnd]);

  const overview = data?.overview;
  const deltas = data?.comparison?.deltas;
  const timeSeries = (data?.timeSeries || []).map((b) => ({
    ...b,
    label:
      b.bucket && b.bucket.includes("T")
        ? new Date(b.bucket).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : b.bucket,
  }));
  const perMonitor = data?.perMonitor || [];

  const comparisonChartData = perMonitor
    .filter((m) => m.uptimePercentage !== null)
    .slice(0, 12)
    .map((m) => ({
      name: m.name.length > 16 ? `${m.name.slice(0, 15)}…` : m.name,
      uptime: m.uptimePercentage,
      avgMs: m.avgResponseTime || 0,
    }));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Advanced Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Availability trends, latency bounds, MTTR, and period-over-period comparisons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
            {["24h", "7d", "30d", "custom"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  range === r
                    ? "bg-[#0E7A88] text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {r === "custom" ? "Custom" : r.toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={selectedMonitorId}
            onChange={(e) => setSelectedMonitorId(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Monitors</option>
            {monitors.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchAnalytics}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {range === "custom" && (
        <Card className="p-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
            Start Date:
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
            End Date:
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={!customStart || !customEnd}
            onClick={fetchAnalytics}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#0E7A88] text-white disabled:opacity-40"
          >
            Apply Range
          </button>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Analytics Error
          </p>
          <p className="text-xs text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white"
          >
            Retry
          </button>
        </Card>
      ) : !overview ? (
        <EmptyState
          icon={BarChart3}
          title="Select a Date Range"
          description="Pick valid start and end dates to compute analytics."
        />
      ) : (
        <>
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Overall Uptime
                </span>
                <Activity className="w-4 h-4 text-[#0E7A88]" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {overview.overallUptime !== null
                  ? `${overview.overallUptime}%`
                  : "No Data"}
              </div>
              <div className="mt-1.5">
                <DeltaBadge delta={deltas?.uptimePercentageDelta} unit="%" />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Avg Response Time
                </span>
                <Gauge className="w-4 h-4 text-[#0E7A88]" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatResponseTime(overview.avgResponseTime)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                <span>
                  Min: {formatResponseTime(overview.minResponseTime)} / Max:{" "}
                  {formatResponseTime(overview.maxResponseTime)}
                </span>
                <DeltaBadge
                  delta={deltas?.avgResponseTimeDelta}
                  unit="ms"
                  inverse
                />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Checks Executed
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {overview.totalChecks.toLocaleString()}
              </div>
              <div className="flex items-center gap-3 text-[11px] mt-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {overview.successfulChecks} UP
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {overview.failedChecks} DOWN
                </span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Incidents
                </span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {overview.totalIncidents}
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1.5">
                <span className="text-slate-500">
                  {overview.activeIncidentsCount} active •{" "}
                  {overview.resolvedIncidentsCount} resolved
                </span>
                <DeltaBadge delta={deltas?.totalIncidentsDelta} inverse />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Downtime
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatDurationMs(overview.totalDowntimeMs)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                Window-clamped outage duration
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Mean Time To Recovery
                </span>
                <Activity className="w-4 h-4 text-[#0E7A88]" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {overview.mttrMs !== null
                  ? formatDurationMs(overview.mttrMs)
                  : "N/A"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                {overview.resolvedIncidentsCount > 0
                  ? `Across ${overview.resolvedIncidentsCount} resolved incident(s)`
                  : "No resolved outages in range"}
              </div>
            </Card>
          </div>

          {/* Trend Charts */}
          {timeSeries.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No Monitoring Data in Window"
              description="Paused monitors and windows without checks do not fabricate uptime percentages."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Availability Trend (%)
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries}>
                      <defs>
                        <linearGradient
                          id="analyticsUptimeGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                        opacity={0.4}
                      />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="uptimePercentage"
                        name="Uptime %"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#analyticsUptimeGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Response Time Trend (ms)
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                        opacity={0.4}
                      />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="avgResponseTime"
                        name="Avg (ms)"
                        stroke="#0E7A88"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="maxResponseTime"
                        name="Max (ms)"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* Service Availability Comparison Chart */}
          {comparisonChartData.length > 1 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Service Availability Comparison (%)
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                      opacity={0.4}
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="uptime"
                      name="Uptime %"
                      fill="#0E7A88"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Per-monitor Breakdown */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Per-Service Breakdown ({perMonitor.length})
              </h2>
            </div>
            {perMonitor.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No monitors configured in this workspace yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">State</th>
                      <th className="py-3 px-4">Uptime</th>
                      <th className="py-3 px-4">Avg / Min / Max</th>
                      <th className="py-3 px-4">Checks (UP/DOWN)</th>
                      <th className="py-3 px-4">Incidents</th>
                      <th className="py-3 px-4">Downtime</th>
                      <th className="py-3 px-4">MTTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {perMonitor.map((m) => (
                      <tr
                        key={m.monitorId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-3 px-4 font-semibold">
                          <Link
                            to={`/monitors/${m.monitorId}`}
                            className="text-[#0E7A88] dark:text-[#38b2ac] hover:underline"
                          >
                            {m.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              m.dataStatus === "PAUSED"
                                ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                : m.dataStatus === "NO_DATA"
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                  : m.currentStatus === "DOWN"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            }`}
                          >
                            {m.isActive ? m.currentStatus : "PAUSED"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          {formatUptime(m.uptimePercentage, m.isActive)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatResponseTime(m.avgResponseTime)} (
                          {formatResponseTime(m.minResponseTime)} /{" "}
                          {formatResponseTime(m.maxResponseTime)})
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {m.totalChecks} ({m.successfulChecks}/{m.failedChecks}
                          )
                        </td>
                        <td className="py-3 px-4">{m.totalIncidents}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDurationMs(m.totalDowntimeMs)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {m.mttrMs !== null ? formatDurationMs(m.mttrMs) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

