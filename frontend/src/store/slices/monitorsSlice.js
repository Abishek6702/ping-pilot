import { createSlice } from "@reduxjs/toolkit";

const monitorsSlice = createSlice({
  name: "monitors",
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    setMonitors: (state, action) => {
      state.items = action.payload || [];
    },
    clearMonitors: (state) => {
      state.items = [];
    },
  },
});

export const { setMonitors, clearMonitors } = monitorsSlice.actions;
export default monitorsSlice.reducer;
