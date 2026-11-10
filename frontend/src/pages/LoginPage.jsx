import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import AuthModal from "../components/auth/AuthModal";
import { ArrowLeft, Radio, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [modalMode] = useState("signin");

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden  flex items-center justify-center">
      {/* Blurred Dashboard Mockup in Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 p-6 sm:p-12 filter blur-md opacity-40 dark:opacity-25 pointer-events-none select-none overflow-hidden scale-105"
      >
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top fake bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0E7A88] flex items-center justify-center text-white">
                <Radio className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-white">
                Ping<span className="text-[#0E7A88]">Pilot</span>
              </span>
            </div>
            <div className="flex gap-2">
              <div className="w-24 h-8 bg-slate-800 rounded-lg" />
              <div className="w-8 h-8 bg-slate-800 rounded-full" />
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-xs text-slate-400">Total Monitors</span>
              <p className="text-2xl font-bold text-white mt-1">6</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-xs text-slate-400">Operational</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">6</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-xs text-slate-400">Avg Latency</span>
              <p className="text-2xl font-bold text-teal-400 mt-1">118ms</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-xs text-slate-400">Overall Uptime</span>
              <p className="text-2xl font-bold text-white mt-1">100%</p>
            </div>
          </div>

          {/* Table preview */}
          <div className="rounded-xl bg-slate-800/90 border border-slate-700 p-6 space-y-4">
            <div className="h-6 w-48 bg-slate-700 rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div className="h-4 w-32 bg-slate-700 rounded" />
                  </div>
                  <div className="h-4 w-16 bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Return Button */}
      <div className="absolute top-6 left-6 z-50">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 backdrop-blur-md transition-colors cursor-pointer shadow-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Homepage</span>
        </button>
      </div>

      {/* Auth Modal Floating Centered */}
      <AuthModal
        isOpen={true}
        onClose={null}
        initialMode={modalMode}
      />
    </div>
  );
}
