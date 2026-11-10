import { createSlice } from "@reduxjs/toolkit";

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem("pingpilot_theme");
    if (saved === "dark" || saved === "light") {
      return saved;
    }
  } catch (e) {
    // ignore
  }
  return "light"; // strictly default Light, no OS detection
};

const initialTheme = getInitialTheme();

// Apply initial theme class to HTML element
if (initialTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

const themeSlice = createSlice({
  name: "theme",
  initialState: {
    mode: initialTheme,
  },
  reducers: {
    toggleTheme: (state) => {
      const nextTheme = state.mode === "light" ? "dark" : "light";
      state.mode = nextTheme;
      localStorage.setItem("pingpilot_theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    setTheme: (state, action) => {
      const theme = action.payload === "dark" ? "dark" : "light";
      state.mode = theme;
      localStorage.setItem("pingpilot_theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;

