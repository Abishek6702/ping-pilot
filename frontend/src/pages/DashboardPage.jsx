import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import Card from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import ResponseTimeChart from "../components/charts/ResponseTimeChart";
import UptimeChart from "../components/charts/UptimeChart";
import MonitorTable from "../components/monitors/MonitorTable";
import MonitorFormModal from "../components/monitors/MonitorFormModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";
import { CardSkeleton, TableSkeleton } from "../components/common/Skeleton";
import {
  Activity,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Zap,
  TrendingUp,
  Plus,
  RefreshCw,
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

export default function DashboardPage() {
  const { user } = useSelector((state) => state.auth);

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState(null);

  const [timeRange, setTimeRange] = useState("24h");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [deletingMonitor, setDeletingMonitor] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Direct normal fetch for dashboard metrics inside this file
  const loadData = useCallback(async (range = timeRange) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dashboard?timeRange=${range}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      } else {
        toast.error(data.error || "Failed to load dashboard");
      }
    } catch (err) {
      toast.error(err.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData(timeRange);
  }, [loadData, timeRange]);

  // Direct normal fetch for manual ping
  const handlePing = async (id) => {
    setPingingId(id);
    try {
      const res = await fetch(`${API_URL}/monitors/${id}/ping`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Ping completed successfully");
        loadData(timeRange);
      } else {
        toast.error(data.error || "Ping failed");
      }
    } catch (err) {
      toast.error(err.message || "Ping request failed");
    } finally {
      setPingingId(null);
    }
  };

  // Direct normal fetch for toggle pause/resume
  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_URL}/monitors/${id}/toggle`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Monitor updated");
        loadData(timeRange);
      } else {
        toast.error(data.error || "Failed to toggle monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to toggle monitor");
    }
  };

  // Direct normal fetch for delete monitor
  const handleDeleteConfirm = async () => {
    if (!deletingMonitor) return;
    try {
      const res = await fetch(`${API_URL}/monitors/${deletingMonitor._id}`, {
        method: "DELETE",
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Monitor deleted successfully");
        setDeletingMonitor(null);
        loadData(timeRange);
      } else {
        toast.error(data.error || "Failed to delete monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete monitor");
    }
  };

  // Direct normal fetch for create / update monitor modal submit
  const handleModalSubmit = async (formData) => {
    setModalLoading(true);
    try {
      const url = editingMonitor
        ? `${API_URL}/monitors/${editingMonitor._id}`
        : `${API_URL}/monitors`;
      const method = editingMonitor ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || (editingMonitor ? "Monitor updated" : "Monitor created"));
        setIsModalOpen(false);
        setEditingMonitor(null);
        loadData(timeRange);
      } else {
        toast.error(data.error || "Failed to save monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save monitor");
    } finally {
      setModalLoading(false);
    }
  };

  const metrics = dashboardData?.metrics || {
    totalMonitors: 0,
    operational: 0,
    down: 0,
    paused: 0,
    averageResponseTime: 0,
    overallUptime: 100,
  };

  const monitors = dashboardData?.monitors || [];
  const charts = dashboardData?.charts || [];
  const recentActivity = dashboardData?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              System Overview
            </h2>
            {user?.role === "admin" && metrics.totalUsers !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0E7A88]/15 text-[#0E7A88]">
                Admin View • {metrics.totalUsers} Total Users
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {user?.role === "admin"
              ? "Global health overview of all endpoints and registered user monitors."
              : "Real-time status of your monitored endpoints and keep-alive health."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range filters */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs shadow-2xs">
            {["24h", "7d", "30d"].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  timeRange === range
                    ? "bg-[#0E7A88] text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {range === "24h" ? "24 Hours" : range === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => loadData(timeRange)}
            title="Refresh metrics"
            className="p-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0E7A88]" : ""}`} />
          </button>

          {/* Add Monitor Button */}
          <button
            type="button"
            onClick={() => {
              setEditingMonitor(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Monitor</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {loading && !dashboardData ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Total Monitors */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total</span>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.totalMonitors}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Configured monitors</div>
          </Card>

          {/* Operational */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Operational</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.operational}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Healthy endpoints</div>
          </Card>

          {/* Down */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Down</span>
              <XCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.down}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Failing thresholds</div>
          </Card>

          {/* Paused */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Paused</span>
              <PauseCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-amber-500">{metrics.paused}</div>
            <div className="text-[11px] text-slate-400 mt-1">Inactive checks</div>
          </Card>

          {/* Average Response Time */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Avg Latency</span>
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.averageResponseTime !== null && metrics.averageResponseTime !== undefined ? (
                <>
                  {metrics.averageResponseTime}
                  <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
                </>
              ) : (
                <span className="text-lg text-slate-400">—</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Last {timeRange}</div>
          </Card>

          {/* Overall Uptime */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#0E7A88] dark:text-[#38b2ac] mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Uptime</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.overallUptime !== null && metrics.overallUptime !== undefined ? (
                `${metrics.overallUptime}%`
              ) : (
                <span className="text-lg text-slate-400">No Data</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Availability ratio</div>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Response Time Trend
            </h3>
            <p className="text-xs text-slate-400">Average latency (ms) over {timeRange}</p>
          </div>
          <ResponseTimeChart data={charts} timeRange={timeRange} />
        </Card>
        <Card className="p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Availability Trend
            </h3>
            <p className="text-xs text-slate-400">Uptime % over {timeRange}</p>
          </div>
          <UptimeChart data={charts} timeRange={timeRange} />
        </Card>
      </div>

      {/* Monitors Overview Table */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Monitored Services
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Current state, latency, and real-time trigger actions.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {monitors.length} active service{monitors.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading && !dashboardData ? (
          <div className="p-4">
            <TableSkeleton rows={5} cols={7} />
          </div>
        ) : monitors.length === 0 ? (
          <EmptyState
            title="No monitors found"
            description="Get started by registering your first API endpoint to enable keep-alive requests."
            actionLabel="Add First Monitor"
            onAction={() => {
              setEditingMonitor(null);
              setIsModalOpen(true);
            }}
          />
        ) : (
          <MonitorTable
            monitors={monitors}
            onPing={handlePing}
            onToggle={handleToggle}
            onEdit={(m) => {
              setEditingMonitor(m);
              setIsModalOpen(true);
            }}
            onDelete={(m) => setDeletingMonitor(m)}
            pingingId={pingingId}
          />
        )}
      </Card>

      {/* Recent Activity List */}
      {recentActivity.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Recent Ping Activity
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {recentActivity.map((p) => (
              <div key={p._id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <div>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {p.monitorId?.name || "Service"}
                    </span>
                    <span className="text-slate-400 ml-2">
                      {p.responseTime}ms • HTTP {p.statusCode || "N/A"}
                    </span>
                  </div>
                </div>
                <span className="text-slate-400">
                  {new Date(p.checkedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add / Edit Monitor Modal */}
      <MonitorFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMonitor(null);
        }}
        onSubmit={handleModalSubmit}
        initialData={editingMonitor}
        loading={modalLoading}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingMonitor)}
        title="Delete Monitor"
        message={`Are you sure you want to delete "${deletingMonitor?.name}"? All associated historical ping data will be permanently removed.`}
        confirmLabel="Delete"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingMonitor(null)}
      />
    </div>
  );
}
