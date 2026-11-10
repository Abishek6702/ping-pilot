import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  Activity,
  Radio,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserX,
  UserCheck,
  Clock,
  Layers,
  ArrowUpRight,
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

export default function AdminUsersPage() {
  const { user } = useSelector((state) => state.auth);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'monitors'
  const [selectedUserForMonitors, setSelectedUserForMonitors] = useState(null);

  // Direct fetch inside AdminUsersPage
  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, usersRes, monitorsRes] = await Promise.all([
        fetch(`${API_URL}/admin/overview`, {
          headers: getHeaders(),
          credentials: "include",
        }),
        fetch(`${API_URL}/admin/users`, {
          headers: getHeaders(),
          credentials: "include",
        }),
        fetch(`${API_URL}/admin/monitors`, {
          headers: getHeaders(),
          credentials: "include",
        }),
      ]);

      const overviewData = await overviewRes.json();
      const usersData = await usersRes.json();
      const monitorsData = await monitorsRes.json();

      if (overviewData.success) {
        setStats(overviewData.stats);
      }
      if (usersData.success) {
        setUsers(usersData.users);
      }
      if (monitorsData.success) {
        setMonitors(monitorsData.monitors);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // If user is not admin, redirect to home
  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  // Direct fetch for toggling user active/inactive status
  const handleToggleUserStatus = async (targetUser) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${targetUser.id}/toggle`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: data.user.isActive } : u))
        );
      } else {
        toast.error(data.error || "Failed to update user status");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update user status");
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === "ALL" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const filteredMonitors = selectedUserForMonitors
    ? monitors.filter((m) => m.userId?._id === selectedUserForMonitors.id)
    : monitors;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Platform Administration
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global management of registered users, tenant endpoints, and system-wide telemetry.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Registered Users
            </span>
            <span className="p-2 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats ? stats.totalUsers : "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Across all tenant accounts</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Monitors
            </span>
            <span className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats ? stats.totalMonitors : "—"}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            {stats ? stats.activeMonitors : 0} currently active
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Failing Services
            </span>
            <span className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats ? stats.downMonitors : "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Alerting across platform</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pings Executed
            </span>
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Radio className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats ? stats.totalPings.toLocaleString() : "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">30-day retention rolling</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("users");
              setSelectedUserForMonitors(null);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "users"
                ? "bg-[#0E7A88] text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Platform Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("monitors")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "monitors"
                ? "bg-[#0E7A88] text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              All Monitors ({monitors.length})
              {selectedUserForMonitors && ` • ${selectedUserForMonitors.name}`}
            </span>
          </button>
        </div>

        {activeTab === "users" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0E7A88] text-slate-900 dark:text-white w-48"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="py-1 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0E7A88]"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admins</option>
              <option value="user">Users</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === "users" ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Auth Method</th>
                  <th className="py-3 px-4">Monitors</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No users found matching query
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const initials = (u.name || u.email)
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#0E7A88]/15 text-[#0E7A88] font-bold flex items-center justify-center text-xs">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {u.name}
                              </p>
                              <p className="text-[11px] text-slate-400">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {u.role === "admin" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0E7A88]/15 text-[#0E7A88]">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              User
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {u.authProviders?.includes("google") ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-semibold uppercase tracking-wider">
                                Google
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold uppercase tracking-wider">
                                Password
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              setSelectedUserForMonitors(u);
                              setActiveTab("monitors");
                            }}
                            className="inline-flex items-center gap-1 text-[#0E7A88] hover:underline font-semibold cursor-pointer"
                          >
                            <span>
                              {u.monitorsCount || 0} monitors ({u.activeMonitorsCount || 0} active)
                            </span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>

                        <td className="py-3 px-4 text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        <td className="py-3 px-4">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-500 font-medium text-[11px]">
                              <XCircle className="w-3.5 h-3.5" />
                              Suspended
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {u.role !== "admin" && (
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              title={u.isActive ? "Suspend User" : "Activate User"}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                u.isActive
                                  ? "border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  : "border-emerald-200 dark:border-emerald-900/60 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              }`}
                            >
                              {u.isActive ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monitors Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          {selectedUserForMonitors && (
            <div className="p-3 bg-[#0E7A88]/10 border-b border-[#0E7A88]/20 flex items-center justify-between text-xs text-[#0E7A88]">
              <span>
                Filtering monitors owned by: <strong>{selectedUserForMonitors.name}</strong> (
                {selectedUserForMonitors.email})
              </span>
              <button
                onClick={() => setSelectedUserForMonitors(null)}
                className="font-semibold underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">URL</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Response Time</th>
                  <th className="py-3 px-4">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMonitors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No monitors found
                    </td>
                  </tr>
                ) : (
                  filteredMonitors.map((m) => (
                    <tr
                      key={m._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {m.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {m.userId ? `${m.userId.name} (${m.userId.email})` : "System/Legacy"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                        {m.url}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.currentStatus === "UP"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : m.currentStatus === "DOWN"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {m.currentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {m.lastResponseTime ? `${m.lastResponseTime}ms` : "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {m.lastCheckedAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(m.lastCheckedAt).toLocaleTimeString()}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

