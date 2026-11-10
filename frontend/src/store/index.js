import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import monitorsReducer from "./slices/monitorsSlice";
import themeReducer from "./slices/themeSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    monitors: monitorsReducer,
    theme: themeReducer,
  },
  devTools: import.meta.env.DEV,
});

export default store;
