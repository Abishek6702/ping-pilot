import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Radio,
  ShieldCheck,
  Zap,
  TrendingUp,
  ArrowRight,
  Sun,
  Moon,
  CheckCircle2,
  Lock,
  Database,
  Users,
  Sparkles,
} from "lucide-react";
import { toggleTheme } from "../store/slices/themeSlice";
import AuthModal from "../components/auth/AuthModal";

export default function LandingPage() {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme.mode);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signin");

  const openAuth = (mode = "signin") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0E7A88] flex items-center justify-center text-white shadow-xs">
              <Radio className="w-4 h-4 animate-pulse-dot" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
              Ping<span className="text-[#0E7A88]">Pilot</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-[#0E7A88] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#0E7A88] transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-[#0E7A88] transition-colors">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            <button
              onClick={() => openAuth("signin")}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Sign In
            </button>

            <button
              onClick={() => openAuth("register")}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0E7A88] hover:bg-[#0b6672] rounded-lg transition-all shadow-xs cursor-pointer"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0E7A88]/10 text-[#0E7A88] text-xs font-semibold mb-6 border border-[#0E7A88]/20 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>100% Free Keep-Alive Platform • Zero Server Sleep</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Keep your backend APIs <br className="hidden sm:inline" />
            <span className="text-[#0E7A88]">awake and monitored</span> 24/7.
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Prevent free-tier instances on Render, Railway, Glitch & Fly.io from going idle.
            Automated 5-minute keep-alive probing, enterprise-grade SSRF defense, and rolling 30-day response latency charts.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => openAuth("register")}
              className="w-full sm:w-auto px-6 py-3 bg-[#0E7A88] hover:bg-[#0b6672] text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#0E7A88]/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5"
            >
              <span>Start Monitoring Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => openAuth("signin")}
              className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              Sign In to Dashboard
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Interval
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">5 Minutes</p>
              <p className="text-[11px] text-[#0E7A88] font-medium">Auto keep-alive</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Cost
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">$0 Free</p>
              <p className="text-[11px] text-emerald-600 font-medium">Free-tier compatible</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Retention
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">30 Days</p>
              <p className="text-[11px] text-slate-500 font-medium">Automatic TTL clean</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Security
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">SSRF Shield</p>
              <p className="text-[11px] text-indigo-500 font-medium">RFC1918 Blocked</p>
            </div>
          </div>
        </div>

        {/* Photorealistic Interactive Dashboard Preview */}
        <div className="mt-14 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 overflow-hidden">
            {/* Mock Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse-dot" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Live Monitoring Preview • 4 Active Endpoints
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Next cycle in 2m 45s</span>
            </div>

            {/* Mock Rows */}
            <div className="space-y-2.5">
              {[
                {
                  name: "Render Production Node.js API",
                  url: "https://my-backend-api.onrender.com/health",
                  status: "UP",
                  time: "142ms",
                  uptime: "100%",
                },
                {
                  name: "User Authentication & OAuth Gateway",
                  url: "https://auth-service.up.railway.app/status",
                  status: "UP",
                  time: "89ms",
                  uptime: "99.9%",
                },
                {
                  name: "PostgreSQL Database Connection Check",
                  url: "https://db-monitor.fly.dev/ping",
                  status: "UP",
                  time: "115ms",
                  uptime: "100%",
                },
              ].map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                      <p className="font-mono text-[11px] text-slate-400 truncate max-w-xs">
                        {row.url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="hidden sm:inline font-medium text-slate-600 dark:text-slate-300">
                      {row.time}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                      {row.status} 200 OK
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-16 bg-white dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Built for Modern Developers & Free Backends
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
              Everything you need to keep services operational, measure latency, and avoid idle cold starts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A88]/10 text-[#0E7A88] flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                5-Minute Keep-Alive Probes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Automated scheduler triggers every 5 minutes using GitHub Actions + in-process engine to ensure Render and Railway instances never spin down.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A88]/10 text-[#0E7A88] flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Multi-Tier SSRF Firewall
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Prevents Server-Side Request Forgery by strictly blocking loopbacks, RFC1918 subnets, cloud metadata (169.254.169.254), and redirect traps.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A88]/10 text-[#0E7A88] flex items-center justify-center mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                30-Day MongoDB TTL Rotation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Historical ping metrics automatically expire after 30 days using MongoDB Atlas native TTL threads without database bloating.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A88]/10 text-[#0E7A88] flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Isolated Tenant Workspaces
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Each registered user gets their own isolated monitors, charts, and ping logs, with an overarching portal dashboard for the administrator.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A88]/10 text-[#0E7A88] flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Latency & Uptime Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Accurate response time measurement via Node.js high-resolution timers, plotted on interactive area charts over 24h, 7d, and 30d windows.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A88]/10 text-[#0E7A88] flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Google OAuth & Secure Cookies
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Sign in effortlessly with Google or email/password. Protected with secure HttpOnly cookies, SameSite restrictions, and bcrypt password hashing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Set Up in Less Than 60 Seconds
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Zero complex configuration required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-5">
            <div className="w-12 h-12 rounded-full bg-[#0E7A88] text-white font-bold flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#0E7A88]/20">
              1
            </div>
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Create an Account</h4>
            <p className="text-xs text-slate-500 mt-1">
              One-click Google login or normal registration to access your private dashboard.
            </p>
          </div>

          <div className="p-5">
            <div className="w-12 h-12 rounded-full bg-[#0E7A88] text-white font-bold flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#0E7A88]/20">
              2
            </div>
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Add Your Service</h4>
            <p className="text-xs text-slate-500 mt-1">
              Input your backend URL, health check route, and custom status code requirements.
            </p>
          </div>

          <div className="p-5">
            <div className="w-12 h-12 rounded-full bg-[#0E7A88] text-white font-bold flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#0E7A88]/20">
              3
            </div>
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Stay Awake 24/7</h4>
            <p className="text-xs text-slate-500 mt-1">
              PingPilot probes your endpoint every 5 minutes, preventing free instances from going cold.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-16 bg-[#0E7A88]/10 border-t border-[#0E7A88]/20 text-center px-4">
        <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Ready to Keep Your Backend Online?
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Start monitoring your personal projects today. No credit card required.
        </p>
        <button
          onClick={() => openAuth("register")}
          className="mt-6 px-6 py-2.5 bg-[#0E7A88] hover:bg-[#0b6672] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-[#0E7A88]/25 cursor-pointer"
        >
          Create Free Account
        </button>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} PingPilot. Personal API Health Monitoring & Keep-Alive Platform.</p>
      </footer>

      {/* Auth Modal with Blurred Backdrop */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
