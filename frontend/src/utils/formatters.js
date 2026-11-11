export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

export function getHeaders() {
  const token = localStorage.getItem("pingpilot_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function formatDurationMs(durationMs) {
  if (durationMs === null || durationMs === undefined || Number.isNaN(Number(durationMs))) {
    return "—";
  }
  const totalSeconds = Math.max(0, Math.round(Number(durationMs) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || (days === 0 && hours === 0 && seconds > 0)) {
    parts.push(`${seconds}s`);
  }
  return parts.join(" ");
}

export function formatDateTime(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatUptime(uptimePercentage, isActive = true) {
  if (uptimePercentage !== null && uptimePercentage !== undefined) {
    return `${uptimePercentage}%`;
  }
  return isActive === false ? "Paused" : "No Data";
}

export function formatResponseTime(responseTime) {
  if (responseTime === null || responseTime === undefined || Number.isNaN(Number(responseTime))) {
    return "—";
  }
  return `${Math.round(Number(responseTime))} ms`;
}

