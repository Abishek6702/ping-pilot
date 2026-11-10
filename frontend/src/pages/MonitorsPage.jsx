import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMonitors,
  pingMonitor,
  toggleMonitor,
  deleteMonitor,
  createMonitor,
  updateMonitor,
} from "../store/slices/monitorsSlice";
import Card from "../components/common/Card";
import MonitorTable from "../components/monitors/MonitorTable";
import MonitorFormModal from "../components/monitors/MonitorFormModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import { Plus, Search, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function MonitorsPage() {
  const dispatch = useDispatch();
  const { items: monitors, loading, pingingId } = useSelector((state) => state.monitors);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [deletingMonitor, setDeletingMonitor] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const loadMonitors = useCallback(() => {
    dispatch(
      fetchMonitors({
        status: statusFilter,
        search: searchQuery,
      })
    );
  }, [dispatch, statusFilter, searchQuery]);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadMonitors();
  };

  const handlePing = async (id) => {
    try {
      const res = await dispatch(pingMonitor(id)).unwrap();
      toast.success(res.message || "Ping completed");
      loadMonitors();
    } catch (err) {
      toast.error(err || "Ping failed");
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await dispatch(toggleMonitor(id)).unwrap();
      toast.success(res.isActive ? "Monitor enabled" : "Monitor paused");
      loadMonitors();
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
      loadMonitors();
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
      loadMonitors();
    } catch (err) {
      toast.error(err || "Failed to save monitor");
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Monitors
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your registered keep-alive endpoints, target URLs, and check thresholds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingMonitor(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Monitor</span>
        </button>
      </div>

      {/* Filters and search bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
            {["ALL", "UP", "DOWN", "PAUSED"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                  statusFilter === status
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {status === "ALL" ? "All Monitors" : status}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or URL..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Search
            </button>
            <button
              type="button"
              onClick={loadMonitors}
              title="Refresh"
              className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </form>
        </div>
      </Card>

      {/* Monitor Table */}
      <Card className="overflow-hidden">
        {loading && monitors.length === 0 ? (
          <TableSkeleton rows={5} cols={6} />
        ) : monitors.length === 0 ? (
          <EmptyState
            title="No monitors match your criteria"
            description="Try adjusting your status filter or search query, or create a new monitor."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditingMonitor(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                Add New Monitor
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
        message={`Are you sure you want to delete "${deletingMonitor?.name}"? All associated historical pings will also be permanently deleted.`}
        confirmText="Delete Monitor"
        confirmVariant="danger"
      />
    </div>
  );
}
