import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMonitorDetails,
  fetchMonitorStats,
  pingMonitor,
  toggleMonitor,
  deleteMonitor,
  updateMonitor,
} from "../store/slices/monitorsSlice";
import Card from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import ResponseTimeChart from "../components/charts/ResponseTimeChart";
import UptimeChart from "../components/charts/UptimeChart";
import MonitorFormModal from "../components/monitors/MonitorFormModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { CardSkeleton } from "../components/common/Skeleton";
import {
  ExternalLink,
  RefreshCw,
  Play,
  Pause,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function MonitorDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { currentMonitor, monitorStats, loading, pingingId } = useSelector(
    (state) => state.monitors
  );

  const [timeRange, setTimeRange] = useState("24h");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const loadData = useCallback(() => {
    if (id) {
      dispatch(fetchMonitorDetails(id));
      dispatch(fetchMonitorStats({ id, timeRange }));
    }
  }, [dispatch, id, timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePing = async () => {
    try {
      const res = await dispatch(pingMonitor(id)).unwrap();
      toast.success(res.message || "Ping completed successfully");
      loadData();
    } catch (err) {
      toast.error(err || "Ping failed");
    }
  };

  const handleToggle = async () => {
    try {
      const res = await dispatch(toggleMonitor(id)).unwrap();
      toast.success(res.isActive ? "Monitor enabled" : "Monitor paused");
      loadData();
    } catch (err) {
      toast.error(err || "Failed to toggle monitor");
    }
  };

  const handleDelete = async () => {
    try {
      await dispatch(deleteMonitor(id)).unwrap();
      toast.success("Monitor deleted successfully");
      navigate("/monitors");
    } catch (err) {
      toast.error(err || "Failed to delete monitor");
    }
  };

  const handleEditSubmit = async (formData) => {
    setModalLoading(true);
    try {
      await dispatch(updateMonitor({ id, data: formData })).unwrap();
      toast.success("Monitor updated successfully");
      setIsEditOpen(false);
      loadData();
    } catch (err) {
      toast.error(err || "Failed to update monitor");
    } finally {
      setModalLoading(false);
    }
  };

  if (!currentMonitor && loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!currentMonitor) {
    return (
      <div className="text-center py-16">
        <h3 className="text-base font-medium text-slate-800 dark:text-slate-200">
          Monitor not found
        </h3>
        <Link
          to="/monitors"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Monitors
        </Link>
      </div>
    );
  }

  const stats = monitorStats?.stats || {
    uptimePercentage: 100,
    averageResponseTime: currentMonitor.lastResponseTime || 0,
    minResponseTime: 0,
    maxResponseTime: 0,
    totalPings: 0,
    failureCount: 0,
  };

  const chartData = monitorStats?.chartData || [];
  const recentPings = monitorStats?.recentPings || [];
  const isPinging = pingingId === id;

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & back */}
      <div className="flex items-center justify-between">
        <Link
          to="/monitors"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Monitors
        </Link>

        {/* Time filters */}
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs shadow-2xs">
          {["24h", "7d", "30d"].map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                timeRange === range
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {range === "24h" ? "24 Hours" : range === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Monitor Header Card */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {currentMonitor.name}
              </h2>
              <StatusBadge status={currentMonitor.currentStatus} size="lg" />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <a
                href={currentMonitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 truncate max-w-md font-mono"
              >
                {currentMonitor.url}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <span>•</span>
              <span>Method: {currentMonitor.method || "GET"}</span>
              <span>•</span>
              <span>Timeout: {currentMonitor.timeout || 15}s</span>
            </div>

            {currentMonitor.description && (
              <p className="text-xs text-slate-400 pt-1">{currentMonitor.description}</p>
            )}

            {currentMonitor.lastError && (
              <div className="mt-2 text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2 rounded-lg">
                Last Error: {currentMonitor.lastError}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start lg:self-center">
            {/* Manual Ping */}
            <button
              type="button"
              onClick={handlePing}
              disabled={isPinging}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isPinging ? "animate-spin text-blue-600" : ""}`}
              />
              <span>{isPinging ? "Pinging..." : "Ping Now"}</span>
            </button>

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={handleToggle}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                currentMonitor.isActive
                  ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100"
                  : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100"
              }`}
            >
              {currentMonitor.isActive ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </>
              )}
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Edit Monitor"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Delete Monitor"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <Card className="p-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Uptime
          </span>
          <div
            className={`text-2xl font-bold mt-1 ${
              stats.uptimePercentage >= 99
                ? "text-emerald-600 dark:text-emerald-400"
                : stats.uptimePercentage >= 95
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {stats.uptimePercentage}%
          </div>
          <span className="text-[11px] text-slate-400">Selected range</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Avg Latency
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {stats.averageResponseTime}
            <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
          </div>
          <span className="text-[11px] text-slate-400">Response time</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Min / Max
          </span>
          <div className="text-base font-semibold text-slate-900 dark:text-white mt-2 font-mono">
            {stats.minResponseTime}ms / {stats.maxResponseTime}ms
          </div>
          <span className="text-[11px] text-slate-400">Fastest vs slowest</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Checks
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.totalPings}
          </div>
          <span className="text-[11px] text-slate-400">Probe requests</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Failures
          </span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {stats.failureCount}
          </div>
          <span className="text-[11px] text-slate-400">Failed checks</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Last Checked
          </span>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 truncate">
            {currentMonitor.lastCheckedAt
              ? new Date(currentMonitor.lastCheckedAt).toLocaleTimeString()
              : "Never"}
          </div>
          <span className="text-[11px] text-slate-400">
            {currentMonitor.lastCheckedAt
              ? new Date(currentMonitor.lastCheckedAt).toLocaleDateString()
              : "No checks yet"}
          </span>
        </Card>
      </div>

      {/* Deep-dive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Response Time Trend
          </h3>
          <p className="text-xs text-slate-400 mb-4">Latency in ms across time range</p>
          <ResponseTimeChart data={chartData} height={250} />
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Uptime Availability
          </h3>
          <p className="text-xs text-slate-400 mb-4">Success percentage over time</p>
          <UptimeChart data={chartData} height={250} />
        </Card>
      </div>

      {/* Recent Ping Log History */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Recent Ping Logs
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Individual probe checks executed for this endpoint.
          </p>
        </div>

        {recentPings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No check logs recorded yet for this endpoint.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">HTTP Status</th>
                  <th className="py-3 px-4">Response Time</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentPings.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4">
                      <StatusBadge status={p.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {p.statusCode ? `HTTP ${p.statusCode}` : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {p.responseTime} ms
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(p.checkedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 truncate max-w-xs">
                      {p.errorMessage ? (
                        <span className="text-rose-500">{p.errorMessage}</span>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <MonitorFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEditSubmit}
        initialData={currentMonitor}
        loading={modalLoading}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Monitor"
        message={`Are you sure you want to delete "${currentMonitor?.name}"? All associated historical check data will be permanently deleted.`}
        confirmText="Delete Monitor"
        confirmVariant="danger"
      />
    </div>
  );
}
