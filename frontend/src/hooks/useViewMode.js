import { useEffect, useState } from "react";

const LARGE_SCREEN_QUERY = "(min-width: 1024px)";

const getResponsiveDefaultMode = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "table";
  }
  return window.matchMedia(LARGE_SCREEN_QUERY).matches ? "table" : "grid";
};

/**
 * Manages a "grid" | "table" view state.
 * Defaults to "grid" on mobile/small viewports (< 1024px) and "table" on large viewports (>= 1024px),
 * dynamically adapting on viewport resize until the user explicitly selects a mode.
 */
export default function useViewMode() {
  const [manualMode, setManualMode] = useState(null);
  const [autoMode, setAutoMode] = useState(getResponsiveDefaultMode);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(LARGE_SCREEN_QUERY);
    const handleChange = (event) => {
      setAutoMode(event.matches ? "table" : "grid");
    };

    setAutoMode(mediaQuery.matches ? "table" : "grid");

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const viewMode = manualMode ?? autoMode;
  return [viewMode, setManualMode];
}

