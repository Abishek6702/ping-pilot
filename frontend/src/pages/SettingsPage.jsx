import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import { setTheme } from "../store/slices/themeSlice";
import { clearAuth } from "../store/slices/authSlice";
import {
  Settings,
  Sun,
  Moon,
  User,
  ShieldCheck,
  LogOut,
  Save,
  CheckCircle2,
  Info,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
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

export default function SettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentTheme = useSelector((state) => state.theme.mode);
  const { user } = useSelector((state) => state.auth);

  const isAdmin = user?.role === "admin";

  const [saving, setSaving] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    appName: "PingPilot",
    defaultInterval: 5,
    defaultTimeout: 15,
    historyRetentionDays: 30,
    failureThreshold: 2,
    name: user?.name || "User",
  });
  const [accountInfo, setAccountInfo] = useState(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Direct fetch for loading settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`${API_URL}/settings`, {
          headers: getHeaders(),
          credentials: "include",
        });
        const data = await res.json();
        if (data.settings) {
          setGeneralSettings((prev) => ({
            ...prev,
            ...data.settings,
            name: data.account?.name || user?.name || prev.name,
          }));
        }
        if (data.account) {
          setAccountInfo(data.account);
        }
      } catch (_err) {
        setAccountInfo({
          name: user?.name,
          email: user?.email,
          role: user?.role,
          authProviders: user?.authProviders,
        });
      }
    }
    loadSettings();
  }, [user]);

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneralSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Direct fetch for saving profile / system configuration
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = isAdmin ? generalSettings : { name: generalSettings.name };

      const res = await fetch(`${API_URL}/settings`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(isAdmin ? "System settings updated" : "Profile updated successfully");
      } else {
        toast.error(data.error || "Failed to update settings");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  // Direct fetch for changing password (both admin and user)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      return toast.error("Please enter a new password");
    }
    if (newPassword.length < 8) {
      return toast.error("New password must be at least 8 characters long");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("New passwords do not match");
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Failed to change password");
      }
    } catch (err) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Direct fetch call inside SettingsPage for logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
      });
    } catch (_e) {
      // ignore
    } finally {
      dispatch(clearAuth());
      toast.success("Signed out successfully");
      navigate("/login");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings & Preferences
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {isAdmin
            ? "Configure system-wide keep-alive probes, global limits, and administrator preferences."
            : "Manage your profile name, change password, appearance theme, and review platform monitoring policies."}
        </p>
      </div>

      {/* Profile & Name Form */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="p-2 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isAdmin ? "Administrator Profile" : "Account Profile"}
            </h3>
            <p className="text-xs text-slate-400">
              Personalized display details and session credentials.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                name="name"
                value={generalSettings.name}
                onChange={handleGeneralChange}
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] focus:border-[#0E7A88] text-slate-900 dark:text-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="text"
                disabled
                value={accountInfo?.email || user?.email || ""}
                className="w-full px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </Card>

      {/* Change Password Card for both Admin and User */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="p-2 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Change Account Password
            </h3>
            <p className="text-xs text-slate-400">
              Update your account password with at least 8 characters.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 pr-9 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                New Password (min 8 chars)
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  className="w-full px-3.5 pr-9 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {passwordLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </Card>

      {/* Admin-Only: Global System Probe Settings */}
      {isAdmin && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
            <div className="p-2 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Platform Probe Configuration (Admin Only)
              </h3>
              <p className="text-xs text-slate-400">
                System-wide default keep-alive intervals, timeouts, and automatic history retention.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Platform Name
                </label>
                <input
                  type="text"
                  name="appName"
                  value={generalSettings.appName}
                  onChange={handleGeneralChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Probe Interval (Minutes)
                </label>
                <input
                  type="number"
                  name="defaultInterval"
                  value={generalSettings.defaultInterval}
                  onChange={handleGeneralChange}
                  min="1"
                  max="1440"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Request Timeout (Seconds)
                </label>
                <input
                  type="number"
                  name="defaultTimeout"
                  value={generalSettings.defaultTimeout}
                  onChange={handleGeneralChange}
                  min="1"
                  max="60"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  History Retention (Days)
                </label>
                <input
                  type="number"
                  name="historyRetentionDays"
                  value={generalSettings.historyRetentionDays}
                  onChange={handleGeneralChange}
                  min="1"
                  max="365"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Failure Threshold
                </label>
                <input
                  type="number"
                  name="failureThreshold"
                  value={generalSettings.failureThreshold}
                  onChange={handleGeneralChange}
                  min="1"
                  max="10"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save System Configuration</span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* User-Only: Platform Policies Info */}
      {!isAdmin && (
        <Card className="p-5 sm:p-6 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/60 dark:border-slate-800 mb-4">
            <Info className="w-4 h-4 text-[#0E7A88]" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Platform Keep-Alive Policy
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-medium">Keep-Alive Frequency</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-1">Every 5 Minutes</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Automated via GitHub Actions</p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-medium">HTTP Probe Timeout</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-1">15 Seconds Default</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Customizable per monitor</p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-medium">Telemetry Retention</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-1">30 Days Rolling</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Automatic TTL cleanup</p>
            </div>
          </div>
        </Card>
      )}

      {/* Appearance: Strictly Light / Dark Theme */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Appearance Theme
            </h3>
            <p className="text-xs text-slate-400">
              Manual toggle. Strictly light or dark mode; persisted in local storage.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => dispatch(setTheme("light"))}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
              currentTheme === "light"
                ? "border-[#0E7A88] bg-[#e8f7f8]/50 dark:bg-[#0E7A88]/20 shadow-xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Light Theme</p>
                <p className="text-xs text-slate-500">Crisp high-contrast layout (Default)</p>
              </div>
            </div>
            {currentTheme === "light" && (
              <CheckCircle2 className="w-5 h-5 text-[#0E7A88] shrink-0" />
            )}
          </div>

          <div
            onClick={() => dispatch(setTheme("dark"))}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
              currentTheme === "dark"
                ? "border-[#0E7A88] bg-[#e8f7f8]/50 dark:bg-[#0E7A88]/20 shadow-xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-800 text-slate-200">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Dark Theme</p>
                <p className="text-xs text-slate-500">Low-light palette for monitoring</p>
              </div>
            </div>
            {currentTheme === "dark" && (
              <CheckCircle2 className="w-5 h-5 text-[#0E7A88] shrink-0" />
            )}
          </div>
        </div>
      </Card>

      {/* Account Info Details */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Account Status & Security
            </h3>
            <p className="text-xs text-slate-400">
              Active identity token, authentication provider, and session management.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Account Role</span>
            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
              {isAdmin ? (
                <span className="text-[#0E7A88] flex items-center gap-1 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Portal Owner (Admin)
                </span>
              ) : (
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  Developer / Monitor Owner
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Authentication Type</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {accountInfo?.authProviders?.includes("google")
                ? "Google OAuth 2.0"
                : "Email & Encrypted Password"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Data Isolation</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dedicated Tenant Workspace
            </span>
          </div>
        </div>

        <div className="pt-5 flex justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Account</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
