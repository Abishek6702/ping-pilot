import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Card from "../components/common/Card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  API_URL,
  formatDateTime,
  formatDurationMs,
  formatResponseTime,
} from "../utils/formatters";

const BANNER_CONFIG = {
  operational: {
    label: "All Systems Operational",
    sublabel: "Every monitored service is responding within expected parameters.",
    bgClass: "bg-emerald-600 text-white",
    Icon: CheckCircle2,
  },
  partial_outage: {
    label: "Partial System Outage",
    sublabel: "One or more services are currently experiencing degraded availability.",
    bgClass: "bg-amber-600 text-white",
    Icon: AlertTriangle,
  },
  major_outage: {
    label: "Major Service Outage",
    sublabel: "Critical monitored services are currently unreachable.",
    bgClass: "bg-rose-600 text-white",
    Icon: XCircle,
  },
  unknown: {
    label: "Monitoring Initializing",
    sublabel: "Services are paused or awaiting their initial scheduled checks.",
    bgClass: "bg-slate-700 text-white",
    Icon: Activity,
  },
};

const SERVICE_STATUS_STYLE = {
  UP: {
    label: "Operational",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  DOWN: {
    label: "Outage",
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900",
    dot: "bg-rose-500",
  },
  PAUSED: {
    label: "Paused",
    badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    dot: "bg-slate-400",
  },
  UNKNOWN: {
    label: "Pending",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900",
    dot: "bg-amber-400",
  },
};

export default function PublicStatusPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState("");

  const fetchPublicStatus = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setNotFoundError("");
      try {
        const suffix = refresh ? "?refresh=1" : "";
        const res = await fetch(`${API_URL}/public/status/${slug}${suffix}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Status page not found");
        }
        setData(json.data);
      } catch (err) {
        setNotFoundError(err.message || "Public status page unavailable");
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    fetchPublicStatus(false);
  }, [fetchPublicStatus]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0E7A88]/30 border-t-[#0E7A88] rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading service status...</p>
        </div>
      </div>
    );
  }

  if (notFoundError && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Status Page Unavailable
          </h1>
          <p className="text-sm text-slate-500">{notFoundError}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white"
          >
            Back to PingPilot
          </Link>
        </Card>
      </div>
    );
  }

  const accent = data?.accentColor || "#0E7A88";
  const banner = BANNER_CONFIG[data?.overallStatus] || BANNER_CONFIG.unknown;
  const BannerIcon = banner.Icon;
  const safeLogoUrl =
    data?.logoUrl && /^https?:\/\//i.test(data.logoUrl) ? data.logoUrl : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Brand */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            {safeLogoUrl ? (
              <img
                src={safeLogoUrl}
                alt={data.name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: accent }}
              >
                {data?.name?.charAt(0)?.toUpperCase() || "P"}
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {data?.name}
              </h1>
              {data?.description && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {data.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchPublicStatus(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Overall Banner */}
        <div
          className={`rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${banner.bgClass}`}
          style={
            data?.overallStatus === "operational"
              ? { backgroundColor: accent }
              : undefined
          }
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <BannerIcon className="w-7 h-7 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h2 className="text-lg font-bold">{banner.label}</h2>
              <p className="text-xs sm:text-sm text-white/85">{banner.sublabel}</p>
            </div>
          </div>
          {data?.overallUptime !== null && data?.overallUptime !== undefined && (
            <div className="bg-black/15 px-4 py-2 rounded-xl text-left sm:text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-white/80">
                30-Day Uptime
              </p>
              <p className="text-lg font-bold">{data.overallUptime}%</p>
            </div>
          )}
        </div>

        {/* Monitored Services List */}
        <Card className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Services ({data?.services?.length || 0})</span>
            <span>30-Day Daily Availability</span>
          </div>

          {!data?.services || data.services.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No public services have been published to this status page yet.
            </div>
          ) : (
            data.services.map((service) => {
              const st =
                SERVICE_STATUS_STYLE[service.status] ||
                SERVICE_STATUS_STYLE.UNKNOWN;
              const bars = service.dailyBars || [];

              return (
                <div key={service.id} className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {service.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${st.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                      {service.url && (
                        <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">
                          {service.url}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                      <span>
                        Uptime:{" "}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {service.uptimePercentage !== null
                            ? `${service.uptimePercentage}%`
                            : service.isActive
                              ? "No Data"
                              : "Paused"}
                        </strong>
                      </span>
                      <span>
                        Latency:{" "}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {formatResponseTime(service.avgResponseTime)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* 30-day bar strip */}
                  <div className="flex items-center gap-1 h-6">
                    {bars.length === 0 ? (
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center">
                        <span className="sr-only">No historical bars</span>
                      </div>
                    ) : (
                      bars.map((bar) => {
                        let color = "bg-emerald-500";
                        if (bar.uptimePercentage === null) color = "bg-slate-200 dark:bg-slate-700";
                        else if (bar.uptimePercentage < 95) color = "bg-rose-500";
                        else if (bar.uptimePercentage < 99.9) color = "bg-amber-400";

                        return (
                          <div
                            key={bar.date}
                            title={`${bar.date}: ${
                              bar.uptimePercentage !== null
                                ? `${bar.uptimePercentage}% (${bar.totalChecks} checks)`
                                : "No checks"
                            }`}
                            className={`flex-1 h-5 rounded-xs ${color} hover:opacity-80 transition-opacity`}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* Incidents Section */}
        {data?.showIncidents !== false && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Incident History
            </h2>
            {!data?.incidents || data.incidents.length === 0 ? (
              <Card className="p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                No outages recorded for these services recently.
              </Card>
            ) : (
              <div className="space-y-3">
                {data.incidents.map((inc) => (
                  <Card key={inc.id || inc.incidentKey} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-semibold text-[#0E7A88]">
                          {inc.incidentKey} • {inc.monitorName}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {inc.title}
                        </h3>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          inc.isActive
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Started: {formatDateTime(inc.startedAt)}
                      </span>
                      {inc.resolvedAt && (
                        <span>
                          Resolved: {formatDateTime(inc.resolvedAt)} (
                          {formatDurationMs(inc.downtimeDurationMs)})
                        </span>
                      )}
                    </div>

                    {Array.isArray(inc.timeline) && inc.timeline.length > 0 && (
                      <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                        {inc.timeline.map((entry, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-2"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              [{entry.status}]
                            </span>
                            <span>{entry.message}</span>
                            <span className="text-slate-400 ml-auto">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="pt-4 text-center text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            Last updated: {formatDateTime(data?.generatedAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            Powered by{" "}
            <Link to="/" className="font-semibold text-[#0E7A88] hover:underline">
              PingPilot
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
