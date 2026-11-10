import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  Radio,
  LayoutDashboard,
  Activity,
  History,
  Settings,
  X,
} from "lucide-react";
import { toggleTheme } from "../../store/slices/themeSlice";
import { clearAuth } from "../../store/slices/authSlice";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

const getHeaders = () => {
  const token = localStorage.getItem("pingpilot_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function Navbar({ onOpenSidebar, pageTitle = "Dashboard", isAdmin = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useSelector((state) => state.theme.mode);
  const { user } = useSelector((state) => state.auth);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // User navlinks: Settings is intentionally hidden from the center tabs (available in profile dropdown)
  const userNavLinks = [
    { name: "Overview", to: "/", icon: LayoutDashboard },
    { name: "Monitors", to: "/monitors", icon: Activity },
    { name: "Monitoring History", to: "/history", icon: History },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Direct fetch call inside Navbar for logout
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
      toast.success("Logged out successfully");
      navigate("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div
        className={`h-full flex items-center justify-between px-4 sm:px-6 relative ${
          !isAdmin ? "max-w-6xl mx-auto w-full" : ""
        }`}
      >
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            /* Admin left: Hamburger (mobile) + Page Title */
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenSidebar}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 lg:hidden rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                {pageTitle}
              </h1>
            </div>
          ) : (
            /* Regular User left: Logo + Brand */
            <NavLink to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0E7A88] flex items-center justify-center text-white shadow-xs">
                <Radio className="w-4 h-4 animate-pulse-dot" />
              </div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                Ping<span className="text-[#0E7A88]">Pilot</span>
              </span>
            </NavLink>
          )}
        </div>

        {/* Regular User Center: Centered Navigation Tabs (Settings hidden) */}
        {!isAdmin && (
          <nav className="hidden md:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
            {userNavLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#0E7A88]/15 text-[#0E7A88] dark:bg-[#0E7A88]/25 dark:text-[#38b2ac] shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        )}

        {/* Right Section: Theme Toggle + Profile Dropdown + Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Manual Theme Toggle (strictly light/dark) */}
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* User profile dropdown (Settings is placed here) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[#0E7A88]/15 dark:bg-[#0E7A88]/30 text-[#0E7A88] dark:text-[#38b2ac] flex items-center justify-center font-bold text-xs border border-[#0E7A88]/30 dark:border-[#0E7A88]/50">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.name || "User"}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight capitalize">
                  {user?.role || "user"}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user?.email}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#0E7A88] dark:text-[#38b2ac] font-medium">
                    {user?.role === "admin" ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> System Administrator
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3" /> Monitor Workspace
                      </>
                    )}
                  </div>
                </div>

                <div className="p-1">
                  {user?.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate("/admin/users");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#0E7A88]" />
                      Platform Administration
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Account Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Regular User Mobile Hamburger */}
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 md:hidden rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Regular User Mobile Navigation Drawer */}
      {!isAdmin && mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1 shadow-lg">
          {userNavLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-[#0E7A88]/10 text-[#0E7A88] dark:bg-[#0E7A88]/20 dark:text-[#38b2ac]"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </header>
  );
}
