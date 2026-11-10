import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const checkAuth = createAsyncThunk("auth/checkAuth", async (_, { rejectWithValue }) => {
  try {
    const res = await api.get("/auth/me");
    return res.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Not authenticated");
  }
});

export const loginWithCredentials = createAsyncThunk(
  "auth/loginWithCredentials",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data.token) {
        localStorage.setItem("pingpilot_token", res.data.token);
      }
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Login failed");
    }
  }
);

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/register", { name, email, password });
      if (res.data.token) {
        localStorage.setItem("pingpilot_token", res.data.token);
      }
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Registration failed");
    }
  }
);

export const loginWithGoogle = createAsyncThunk(
  "auth/loginWithGoogle",
  async ({ idToken }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/google", { idToken });
      if (res.data.token) {
        localStorage.setItem("pingpilot_token", res.data.token);
      }
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Google login failed");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  try {
    await api.post("/auth/logout");
  } catch (_e) {
    // ignore
  } finally {
    localStorage.removeItem("pingpilot_token");
  }
  return true;
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: localStorage.getItem("pingpilot_token") || null,
    isAuthenticated: false,
    loading: false,
    isInitialized: false,
    error: null,
  },
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    setAuthUser: (state, action) => {
      state.user = action.payload.user || action.payload;
      if (action.payload.token) {
        state.token = action.payload.token;
        localStorage.setItem("pingpilot_token", action.payload.token);
      }
      state.isAuthenticated = true;
      state.isInitialized = true;
      state.loading = false;
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
      state.loading = false;
      state.error = null;
      localStorage.removeItem("pingpilot_token");
    },
  },
  extraReducers: (builder) => {
    builder
      // checkAuth
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isInitialized = true;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.loading = false;
        state.isInitialized = true;
        state.isAuthenticated = false;
        state.user = null;
      })
      // loginWithCredentials
      .addCase(loginWithCredentials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithCredentials.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginWithCredentials.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      // registerUser
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      // loginWithGoogle
      .addCase(loginWithGoogle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      // logoutUser
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      });
  },
});

export const { clearAuthError, setAuthUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
