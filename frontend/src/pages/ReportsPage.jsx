import React, { useState, useEffect, useCallback } from "react";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import {
  FileText,
  Download,
  FileSpreadsheet,
  Eye,
  AlertTriangle,
  Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, getHeaders } from "../utils/formatters";

const REPORT_TYPES = [
  {
    id: "summary",
    label: "Overall Monitoring Summary",
    description: "Consolidated service status, uptime %, avg latency, and incident totals.",
  },
  {
    id: "uptime",
    label: "Service Uptime & SLA",
    description: "Check counts, success rates, and explicit paused/no-data monitoring states.",
  },
  {
    id: "response-time",
    label: "Response Time Performance",
    description: "Minimum, average, and maximum response time benchmarks per service.",
  },
  {
    id: "incidents",
    label: "Incident Log Report",
    description: "Chronological outage list with stage, timestamps, failed checks, and notes.",
  },
  {
    id: "downtime",
    label: "Downtime Analysis",
    description: "Exact window-clamped outage durations across monitored endpoints.",
  },
  {
    id: "comparison",
    label: "Service Comparison",
    description: "Side-by-side reliability and MTTR comparison across all services.",
  },
];

const COMMON_TIMEZONES = Array.from(
  new Set([
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    "UTC",
    "Asia/Kolkata",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Singapore",
  ])
);

export default function ReportsPage() {
  const [reportType, setReportType] = useState("summary");
  const [range, setRange] = useState("7d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monitorId, setMonitorId] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );

  const [monitors, setMonitors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
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
        // non-blocking
      }
    })();
  }, []);

  const buildQueryString = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams({
        type: reportType,
        range,
        timezone,
        ...extra,
      });
      if (monitorId) params.set("monitorId", monitorId);
      if (range === "custom") {
        if (startDate) params.set("startDate", new Date(startDate).toISOString());
        if (endDate) {
          const endD = new Date(endDate);
          endD.setHours(23, 59, 59, 999);
          params.set("endDate", endD.toISOString());
        }
      }
      return params.toString();
    },
    [reportType, range, startDate, endDate, monitorId, timezone]
  );

  const fetchPreview = useCallback(async () => {
    if (range === "custom" && (!startDate || !endDate)) {
      toast.error("Select both start and end dates for a custom report window");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = buildQueryString();
      const res = await fetch(`${API_URL}/reports/preview?${qs}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate report preview");
      }
      setPreview(json.data);
    } catch (err) {
      setError(err.message || "Could not load report preview");
    } finally {
      setLoading(false);
    }
  }, [buildQueryString, range, startDate, endDate]);

  useEffect(() => {
    if (range !== "custom") {
      fetchPreview();
    }
  }, [reportType, range, monitorId, timezone, fetchPreview]);

  const handleDownload = async (format) => {
    if (range === "custom" && (!startDate || !endDate)) {
      toast.error("Select both start and end dates first");
      return;
    }
    setExportingFormat(format);
    try {
      const qs = buildQueryString({ format });
      const res = await fetch(`${API_URL}/reports/export?${qs}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Failed to export ${format.toUpperCase()}`;
        try {
          const errJson = await res.json();
          msg = errJson.error || msg;
        } catch {
          // ignore JSON parse failure
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename =
        filenameMatch?.[1] ||
        `pingpilot-${reportType}-report-${new Date().toISOString().slice(0, 10)}.${format}`;

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (err) {
      toast.error(err.message || "Report export failed");
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Reports & Exports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Preview availability metrics and download audit-ready CSV or PDF reports.
        </p>
      </div>

      {/* Report Configuration Builder */}
      <Card className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Time Window
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Monitor Scope
            </label>
            <select
              value={monitorId}
              onChange={(e) => setMonitorId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100"
            >
              <option value="">All Accessible Monitors</option>
              {monitors.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                Report Timezone
              </span>
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              Start:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              End:
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </label>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            {REPORT_TYPES.find((t) => t.id === reportType)?.description}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchPreview}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => handleDownload("csv")}
              disabled={Boolean(exportingFormat)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-[#0E7A88] text-[#0E7A88] dark:text-[#38b2ac] hover:bg-[#e8f7f8] dark:hover:bg-[#0E7A88]/10 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exportingFormat === "csv" ? "Exporting..." : "Download CSV"}
            </button>
            <button
              type="button"
              onClick={() => handleDownload("pdf")}
              disabled={Boolean(exportingFormat)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0E7A88] text-white hover:bg-[#0a5f6a] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exportingFormat === "pdf" ? "Generating PDF..." : "Download PDF"}
            </button>
          </div>
        </div>
      </Card>

      {/* Report Preview */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={fetchPreview}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white"
          >
            Retry Preview
          </button>
        </Card>
      ) : !preview ? (
        <EmptyState
          icon={FileText}
          title="Configure and Preview Your Report"
          description="Select dates above and click Preview to inspect tabular rows before exporting CSV or PDF."
        />
      ) : (
        <div className="space-y-4">
          {/* Metadata & KPI Summary */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {preview.metadata.title}
                </h2>
                <p className="mt-0.5">
                  Window: {preview.metadata.windowStart} →{" "}
                  {preview.metadata.windowEnd}
                </p>
              </div>
              <div className="text-right">
                <p>Generated: {preview.metadata.generatedAt}</p>
                <p>{preview.totalRows} matching record(s)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-slate-500">Overall Uptime</p>
                <p className="text-sm font-bold mt-0.5">
                  {preview.summary.overallUptime}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-slate-500">Avg Response</p>
                <p className="text-sm font-bold mt-0.5">
                  {preview.summary.avgResponseTime}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-slate-500">Total Checks</p>
                <p className="text-sm font-bold mt-0.5">
                  {preview.summary.totalChecks}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-slate-500">Incidents</p>
                <p className="text-sm font-bold mt-0.5">
                  {preview.summary.totalIncidents}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-slate-500">Downtime</p>
                <p className="text-sm font-bold mt-0.5">
                  {preview.summary.totalDowntime}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-slate-500">MTTR</p>
                <p className="text-sm font-bold mt-0.5">{preview.summary.mttr}</p>
              </div>
            </div>
          </Card>

          {/* Table */}
          {preview.rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Data For Selected Range"
              description="No monitoring checks or incidents occurred in this reporting window."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 uppercase">
                      {preview.columns.map((col) => (
                        <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                      >
                        {preview.columns.map((col) => (
                          <td
                            key={col.key}
                            className="py-3 px-4 text-slate-700 dark:text-slate-200 max-w-xs truncate"
                            title={String(row[col.key] ?? "")}
                          >
                            {row[col.key] !== undefined && row[col.key] !== null
                              ? String(row[col.key])
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.truncated && (
                <div className="px-4 py-2.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                  Showing first 100 of {preview.totalRows} rows in preview. Export CSV or PDF to download the complete dataset.
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

