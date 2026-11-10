import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Card from "../components/common/Card";
import { setTheme } from "../store/slices/themeSlice";
import { logoutUser } from "../store/slices/authSlice";
import {
  Settings,
  Sun,
  Moon,
  User,
  ShieldCheck,
  LogOut,
  Save,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentTheme = useSelector((state) => state.theme.mode);
  const { user } = useSelector((state) => state.auth);

  const [saving, setSaving] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    appName: "PingPilot",
    defaultInterval: 5,
    defaultTimeout: 15,
    historyRetentionDays: 30,
    failureThreshold: 2,
    name: user?.name || "Admin",
  });
  const [accountInfo, setAccountInfo] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.get("/settings");
        if (res.data.settings) {
          setGeneralSettings((prev) => ({
            ...prev,
            ...res.data.settings,
            name: res.data.account?.name || prev.name,
          }));
        }
        if (res.data.account) {
          setAccountInfo(res.data.account);
        }
      } catch (_err) {
        toast.error("Failed to load settings");
      }
    }
    loadSettings();
  }, []);

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneralSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/settings", generalSettings);
      toast.success("Settings updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      toast.success("Signed out successfully");
      navigate("/login");
    } catch (e) {
      navigate("/login");
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Application Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure probe parameters, appearance preferences, and administrator credentials.
        </p>
      </div>

      {/* Section A: General Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <Settings className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              General Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Core monitoring intervals, timeouts, and automatic history expiration.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Application Name
              </label>
              <input
                type="text"
                name="appName"
                value={generalSettings.appName}
                onChange={handleGeneralChange}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Admin Display Name
              </label>
              <input
                type="text"
                name="name"
                value={generalSettings.name}
                onChange={handleGeneralChange}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Default Monitoring Interval (Minutes)
              </label>
              <input
                type="number"
                name="defaultInterval"
                value={generalSettings.defaultInterval}
                onChange={handleGeneralChange}
                min="1"
                max="1440"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                GitHub Actions scheduler runs every 5 minutes.
              </p>
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
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
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
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Managed via MongoDB TTL indexing (default 30 days).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Consecutive Failure Threshold
              </label>
              <input
                type="number"
                name="failureThreshold"
                value={generalSettings.failureThreshold}
                onChange={handleGeneralChange}
                min="1"
                max="10"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Number of consecutive check failures before status flips to DOWN.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </Card>

      {/* Section B: Appearance (Strictly Light / Dark Theme) */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <Sun className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Appearance Theme
            </h3>
            <p className="text-xs text-slate-400">
              Select your preferred visual style. No system auto-detection; persisted in browser storage.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Light Theme Box */}
          <div
            onClick={() => dispatch(setTheme("light"))}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
              currentTheme === "light"
                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Light Theme</p>
                <p className="text-xs text-slate-500">Clean, crisp high-contrast layout (Default)</p>
              </div>
            </div>
            {currentTheme === "light" && (
              <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            )}
          </div>

          {/* Dark Theme Box */}
          <div
            onClick={() => dispatch(setTheme("dark"))}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
              currentTheme === "dark"
                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-800 text-slate-200">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Dark Theme</p>
                <p className="text-xs text-slate-500">Subtle low-light palette for night monitoring</p>
              </div>
            </div>
            {currentTheme === "dark" && (
              <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            )}
          </div>
        </div>
      </Card>

      {/* Section C: Account Management */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <User className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Administrator Profile
            </h3>
            <p className="text-xs text-slate-400">
              Authenticated admin credentials and Google OAuth link status.
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Administrator Email</span>
            <span className="font-mono text-slate-900 dark:text-white font-semibold">
              {accountInfo?.email || user?.email || "admin@pingpilot.local"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Access Role</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Single Admin (Full Access)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Google Account Linked</span>
            <span>
              {accountInfo?.hasGoogleAuth ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="text-slate-400">Not linked</span>
              )}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Last Login</span>
            <span className="text-slate-700 dark:text-slate-300">
              {accountInfo?.lastLoginAt
                ? new Date(accountInfo.lastLoginAt).toLocaleString()
                : "Active session"}
            </span>
          </div>
        </div>

        <div className="pt-6 flex justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Administrator</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
