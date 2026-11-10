import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { checkAuth } from "./store/slices/authSlice";
import Layout from "./components/layout/Layout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MonitorsPage from "./pages/MonitorsPage";
import MonitorDetailsPage from "./pages/MonitorDetailsPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import NotFoundPage from "./pages/NotFoundPage";
import { Toaster } from "react-hot-toast";

function RootRoute() {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!isInitialized) {
      dispatch(checkAuth());
    }
  }, [dispatch, isInitialized]);

  if (!isInitialized && loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0E7A88]/30 border-t-[#0E7A88] rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Initializing PingPilot...</p>
        </div>
      </div>
    );
  }

  if (isInitialized && !isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <Layout>
      <DashboardPage />
    </Layout>
  );
}

function ProtectedRoute({ children }) {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!isInitialized) {
      dispatch(checkAuth());
    }
  }, [dispatch, isInitialized]);

  if (!isInitialized && loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0E7A88]/30 border-t-[#0E7A88] rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Initializing PingPilot...</p>
        </div>
      </div>
    );
  }

  if (isInitialized && !isAuthenticated) {
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
  const theme = useSelector((state) => state.theme.mode);

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
          <Route path="/history" element={<HistoryPage />} />
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
