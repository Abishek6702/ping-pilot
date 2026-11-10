import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchDashboard = createAsyncThunk(
  "monitors/fetchDashboard",
  async (timeRange = "24h", { rejectWithValue }) => {
    try {
      const res = await api.get(`/dashboard?timeRange=${timeRange}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load dashboard data");
    }
  }
);

export const fetchMonitors = createAsyncThunk(
  "monitors/fetchMonitors",
  async ({ status = "ALL", search = "", page = 1, limit = 50 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status && status !== "ALL") params.append("status", status);
      if (search) params.append("search", search);
      params.append("page", page);
      params.append("limit", limit);

      const res = await api.get(`/monitors?${params.toString()}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load monitors");
    }
  }
);

export const createMonitor = createAsyncThunk(
  "monitors/createMonitor",
  async (monitorData, { rejectWithValue }) => {
    try {
      const res = await api.post("/monitors", monitorData);
      return res.data.monitor;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to create monitor");
    }
  }
);

export const updateMonitor = createAsyncThunk(
  "monitors/updateMonitor",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/monitors/${id}`, data);
      return res.data.monitor;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to update monitor");
    }
  }
);

export const deleteMonitor = createAsyncThunk(
  "monitors/deleteMonitor",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/monitors/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to delete monitor");
    }
  }
);

export const toggleMonitor = createAsyncThunk(
  "monitors/toggleMonitor",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/monitors/${id}/toggle`);
      return res.data.monitor;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to toggle monitor");
    }
  }
);

export const pingMonitor = createAsyncThunk(
  "monitors/pingMonitor",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.post(`/monitors/${id}/ping`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Ping failed");
    }
  }
);

export const fetchMonitorDetails = createAsyncThunk(
  "monitors/fetchMonitorDetails",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/monitors/${id}`);
      return res.data.monitor;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load monitor details");
    }
  }
);

export const fetchMonitorStats = createAsyncThunk(
  "monitors/fetchMonitorStats",
  async ({ id, timeRange = "24h" }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/monitors/${id}/stats?timeRange=${timeRange}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load monitor stats");
    }
  }
);

export const fetchHistory = createAsyncThunk(
  "monitors/fetchHistory",
  async ({ monitorId, status, timeRange, page = 1, limit = 30 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (monitorId) params.append("monitorId", monitorId);
      if (status && status !== "ALL") params.append("status", status);
      if (timeRange) params.append("timeRange", timeRange);
      params.append("page", page);
      params.append("limit", limit);

      const res = await api.get(`/history?${params.toString()}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load history");
    }
  }
);

const monitorsSlice = createSlice({
  name: "monitors",
  initialState: {
    items: [],
    pagination: { page: 1, limit: 50, total: 0, pages: 1 },
    currentMonitor: null,
    monitorStats: null,
    dashboardData: null,
    historyData: null,
    loading: false,
    pingingId: null,
    error: null,
  },
  reducers: {
    clearCurrentMonitor: (state) => {
      state.currentMonitor = null;
      state.monitorStats = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchDashboard
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboardData = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchMonitors
      .addCase(fetchMonitors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMonitors.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.monitors;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchMonitors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // createMonitor
      .addCase(createMonitor.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      // updateMonitor
      .addCase(updateMonitor.fulfilled, (state, action) => {
        const index = state.items.findIndex((m) => m._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentMonitor && state.currentMonitor._id === action.payload._id) {
          state.currentMonitor = action.payload;
        }
      })
      // deleteMonitor
      .addCase(deleteMonitor.fulfilled, (state, action) => {
        state.items = state.items.filter((m) => m._id !== action.payload);
        if (state.currentMonitor && state.currentMonitor._id === action.payload) {
          state.currentMonitor = null;
        }
      })
      // toggleMonitor
      .addCase(toggleMonitor.fulfilled, (state, action) => {
        const index = state.items.findIndex((m) => m._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentMonitor && state.currentMonitor._id === action.payload._id) {
          state.currentMonitor = action.payload;
        }
      })
      // pingMonitor
      .addCase(pingMonitor.pending, (state, action) => {
        state.pingingId = action.meta.arg;
      })
      .addCase(pingMonitor.fulfilled, (state, action) => {
        state.pingingId = null;
        const updated = action.payload.monitor;
        if (updated) {
          const index = state.items.findIndex((m) => m._id === updated._id);
          if (index !== -1) {
            state.items[index] = { ...state.items[index], ...updated };
          }
          if (state.currentMonitor && state.currentMonitor._id === updated._id) {
            state.currentMonitor = { ...state.currentMonitor, ...updated };
          }
        }
      })
      .addCase(pingMonitor.rejected, (state) => {
        state.pingingId = null;
      })
      // fetchMonitorDetails
      .addCase(fetchMonitorDetails.fulfilled, (state, action) => {
        state.currentMonitor = action.payload;
      })
      // fetchMonitorStats
      .addCase(fetchMonitorStats.fulfilled, (state, action) => {
        state.monitorStats = action.payload;
      })
      // fetchHistory
      .addCase(fetchHistory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.historyData = action.payload;
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCurrentMonitor } = monitorsSlice.actions;
export default monitorsSlice.reducer;

