import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchDashboard,
  pingMonitor,
  toggleMonitor,
  deleteMonitor,
  createMonitor,
  updateMonitor,
} from "../store/slices/monitorsSlice";
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

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { dashboardData, loading, pingingId } = useSelector((state) => state.monitors);

  const [timeRange, setTimeRange] = useState("24h");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [deletingMonitor, setDeletingMonitor] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const loadData = useCallback((range = timeRange) => {
    dispatch(fetchDashboard(range));
  }, [dispatch, timeRange]);

  useEffect(() => {
    loadData(timeRange);
  }, [loadData, timeRange]);

  const handlePing = async (id) => {
    try {
      const res = await dispatch(pingMonitor(id)).unwrap();
      toast.success(res.message || "Ping completed successfully");
      loadData();
    } catch (err) {
      toast.error(err || "Ping failed");
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await dispatch(toggleMonitor(id)).unwrap();
      toast.success(res.isActive ? "Monitor enabled" : "Monitor paused");
      loadData();
    } catch (err) {
      toast.error(err || "Failed to toggle monitor");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMonitor) return;
    try {
      await dispatch(deleteMonitor(deletingMonitor._id)).unwrap();
      toast.success("Monitor deleted successfully");
      setDeletingMonitor(null);
      loadData();
    } catch (err) {
      toast.error(err || "Failed to delete monitor");
    }
  };

  const handleModalSubmit = async (formData) => {
    setModalLoading(true);
    try {
      if (editingMonitor) {
        await dispatch(
          updateMonitor({ id: editingMonitor._id, data: formData })
        ).unwrap();
        toast.success("Monitor updated successfully");
      } else {
        await dispatch(createMonitor(formData)).unwrap();
        toast.success("Monitor created successfully");
      }
      setIsModalOpen(false);
      setEditingMonitor(null);
      loadData();
    } catch (err) {
      toast.error(err || "Failed to save monitor");
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
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            System Overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time status of keep-alive probes and endpoint availability.
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
                    ? "bg-blue-600 text-white shadow-2xs"
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
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {/* Add Monitor Button */}
          <button
            type="button"
            onClick={() => {
              setEditingMonitor(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
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
            <span className="text-[11px] text-slate-400 mt-1">Configured endpoints</span>
          </Card>

          {/* Operational */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Operational</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.operational}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Passing checks</span>
          </Card>

          {/* Down */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Down</span>
              <XCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.down}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Failing endpoints</span>
          </Card>

          {/* Paused */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Paused</span>
              <PauseCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.paused}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Monitoring off</span>
          </Card>

          {/* Average Response Time */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Avg Latency</span>
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {metrics.averageResponseTime}
              <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Across probes</span>
          </Card>

          {/* Overall Uptime */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-500 mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Uptime</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div
              className={`text-2xl font-bold ${
                metrics.overallUptime >= 99
                  ? "text-emerald-600 dark:text-emerald-400"
                  : metrics.overallUptime >= 95
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {metrics.overallUptime}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1">In selected range</span>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Response Time Trend
              </h3>
              <p className="text-xs text-slate-400">Average HTTP response time in milliseconds</p>
            </div>
          </div>
          <ResponseTimeChart data={charts} height={240} />
        </Card>

        {/* Uptime History Chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Uptime Availability
              </h3>
              <p className="text-xs text-slate-400">Percentage of successful checks over time</p>
            </div>
          </div>
          <UptimeChart data={charts} height={240} />
        </Card>
      </div>

      {/* Monitors Overview Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Monitored Endpoints
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status and keep-alive health for registered services.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {monitors.length} {monitors.length === 1 ? "service" : "services"}
          </span>
        </div>

        {loading && !dashboardData ? (
          <TableSkeleton rows={5} cols={6} />
        ) : monitors.length === 0 ? (
          <EmptyState
            title="No monitors yet"
            description="Add your backend or Render service URL to begin 5-minute health monitoring."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditingMonitor(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                Add Your First Monitor
              </button>
            }
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

      {/* Recent Activity Feed */}
      {recentActivity.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Recent Ping Activity
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {recentActivity.map((ping) => (
              <div
                key={ping._id}
                className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/20 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={ping.status} size="sm" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {ping.monitorId?.name || "Unknown Monitor"}
                  </span>
                  {ping.statusCode && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-400">
                      HTTP {ping.statusCode}
                    </span>
                  )}
                  {ping.errorMessage && (
                    <span className="text-[11px] text-rose-500 truncate max-w-xs">
                      {ping.errorMessage}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-slate-400">
                  <span className="font-mono">{ping.responseTime}ms</span>
                  <span>{new Date(ping.checkedAt).toLocaleTimeString()}</span>
                </div>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingMonitor)}
        onClose={() => setDeletingMonitor(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Monitor"
        message={`Are you sure you want to delete "${deletingMonitor?.name}"? All associated ping history will be permanently deleted.`}
        confirmText="Delete Monitor"
        confirmVariant="danger"
      />
    </div>
  );
}
