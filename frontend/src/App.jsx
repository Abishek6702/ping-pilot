import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setAuthUser, clearAuth } from "./store/slices/authSlice";
import Layout from "./components/layout/Layout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MonitorsPage from "./pages/MonitorsPage";
import MonitorDetailsPage from "./pages/MonitorDetailsPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ApiTesterPage from "./pages/ApiTesterPage";
import IncidentsPage from "./pages/IncidentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import StatusPagesPage from "./pages/StatusPagesPage";
import PublicStatusPage from "./pages/PublicStatusPage";
import ReportsPage from "./pages/ReportsPage";
import NotFoundPage from "./pages/NotFoundPage";
import { Toaster } from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

const getHeaders = () => {
  const token = localStorage.getItem("pingpilot_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#0E7A88]/30 border-t-[#0E7A88] rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Initializing PingPilot...</p>
      </div>
    </div>
  );
}

function RootRoute() {
  const { isAuthenticated, isInitialized } = useSelector((state) => state.auth);

  if (!isInitialized) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <Layout>
      <DashboardPage />
    </Layout>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitialized } = useSelector((state) => state.auth);

  if (!isInitialized) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user } = useSelector((state) => state.auth);
  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme.mode);
  const { isInitialized } = useSelector((state) => state.auth);

  // Direct fetch call inside App.jsx to verify session upon startup
  useEffect(() => {
    const verifyUserSession = async () => {
      try {
        const token = localStorage.getItem("pingpilot_token");
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: getHeaders(),
          credentials: "include",
        });
        const data = await res.json();
        if (data.success && data.user) {
          dispatch(setAuthUser({ user: data.user, token }));
        } else {
          dispatch(clearAuth());
        }
      } catch (_err) {
        dispatch(clearAuth());
      }
    };

    if (!isInitialized) {
      verifyUserSession();
    }
  }, [dispatch, isInitialized]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: theme === "dark" ? "#0f172a" : "#ffffff",
            color: theme === "dark" ? "#f8fafc" : "#0f172a",
            border: theme === "dark" ? "1px solid #1e293b" : "1px solid #e2e8f0",
            fontSize: "13px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          },
        }}
      />
      <Routes>
        {/* Root Route: Shows LandingPage when unauthenticated, DashboardPage when authenticated */}
        <Route path="/" element={<RootRoute />} />

        {/* Login Page with blurred dashboard backdrop and centered modal */}
        <Route path="/login" element={<LoginPage />} />

        {/* Unauthenticated Public Status Pages */}
        <Route path="/status/:slug" element={<PublicStatusPage />} />

        {/* Authenticated Application Routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/monitors" element={<MonitorsPage />} />
          <Route path="/monitors/:id" element={<MonitorDetailsPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/status-pages" element={<StatusPagesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/tester" element={<ApiTesterPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
