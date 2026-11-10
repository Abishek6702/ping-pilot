import { createSlice } from "@reduxjs/toolkit";

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
    setAuthLoading: (state, action) => {
      state.loading = action.payload !== undefined ? action.payload : true;
    },
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
});

export const { setAuthLoading, clearAuthError, setAuthUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
