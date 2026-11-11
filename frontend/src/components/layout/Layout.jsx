import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  const isAdmin = user?.role === "admin";

  const getPageTitle = (pathname) => {
    if (pathname === "/") return "Overview";
    if (pathname.startsWith("/monitors/")) return "Monitor Details";
    if (pathname.startsWith("/monitors")) return "Monitors";
    if (pathname.startsWith("/history")) return "Monitoring History";
    if (pathname.startsWith("/tester")) return "API Tester";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/admin")) return "Platform Administration";
    return "PingPilot";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Sidebar navigation: exclusively for system administrator */}
      {isAdmin && (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

      {/* Main content wrapper */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all ${
          isAdmin ? "lg:pl-64" : "w-full"
        }`}
      >
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          pageTitle={getPageTitle(location.pathname)}
          isAdmin={isAdmin}
        />
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 w-full mx-auto ${
            isAdmin ? "max-w-7xl" : "max-w-6xl"
          }`}
        >
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
