import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Card from "../components/common/Card";
import MonitorTable from "../components/monitors/MonitorTable";
import MonitorFormModal from "../components/monitors/MonitorFormModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import { Plus, Search, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

const getHeaders = () => {
  const token = localStorage.getItem("pingpilot_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [deletingMonitor, setDeletingMonitor] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Direct fetch inside MonitorsPage
  const loadMonitors = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") query.append("status", statusFilter);
      if (searchQuery) query.append("search", searchQuery);

      const res = await fetch(`${API_URL}/monitors?${query.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMonitors(data.monitors || []);
      } else {
        toast.error(data.error || "Failed to load monitors");
      }
    } catch (err) {
      toast.error(err.message || "Failed to fetch monitors");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadMonitors();
  };

  // Direct fetch for manual ping
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
        loadMonitors();
      } else {
        toast.error(data.error || "Ping failed");
      }
    } catch (err) {
      toast.error(err.message || "Ping request failed");
    } finally {
      setPingingId(null);
    }
  };

  // Direct fetch for toggle status
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
        loadMonitors();
      } else {
        toast.error(data.error || "Failed to toggle monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to toggle monitor");
    }
  };

  // Direct fetch for delete monitor
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
        loadMonitors();
      } else {
        toast.error(data.error || "Failed to delete monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete monitor");
    }
  };

  // Direct fetch for modal submit
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
        loadMonitors();
      } else {
        toast.error(data.error || "Failed to save monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save monitor");
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
            Monitored Services
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure periodic keep-alive probes, expected HTTP responses, and timeout limits.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/tester"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0E7A88]" />
            <span>API Tester</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setEditingMonitor(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Monitor</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs w-full sm:w-auto">
            {["ALL", "UP", "DOWN", "PAUSED"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? "bg-white dark:bg-slate-900 text-[#0E7A88] shadow-2xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or URL..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={loadMonitors}
              title="Refresh monitors"
              className="p-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0E7A88]" : ""}`} />
            </button>
          </form>
        </div>
      </Card>

      {/* Monitor List Table */}
      <Card className="overflow-hidden">
        {loading && monitors.length === 0 ? (
          <div className="p-4">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : monitors.length === 0 ? (
          <EmptyState
            title="No monitors match your filter"
            description={
              searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search criteria or filter options to view available monitors."
                : "Get started by registering your first API endpoint to enable keep-alive requests."
            }
            actionLabel={searchQuery || statusFilter !== "ALL" ? null : "Add First Monitor"}
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
