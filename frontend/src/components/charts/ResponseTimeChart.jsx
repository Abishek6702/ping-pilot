import React from "react";
import { useSelector } from "react-redux";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ResponseTimeChart({ data = [], height = 260 }) {
  const theme = useSelector((state) => state.theme.mode);
  const isDark = theme === "dark";

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500"
        style={{ height }}
      >
        No response time data available for this range
      </div>
    );
  }

  // Format label for tooltip / axis
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.split(" ");
    return parts.length > 1 ? parts[1] : timeStr;
  };

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="responseTimeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0E7A88" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0E7A88" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "#1e293b" : "#f1f5f9"}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke={isDark ? "#475569" : "#94a3b8"}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }}
          />
          <YAxis
            stroke={isDark ? "#475569" : "#94a3b8"}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            unit="ms"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#0f172a" : "#ffffff",
              borderColor: isDark ? "#1e293b" : "#e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontSize: "12px",
              color: isDark ? "#f8fafc" : "#0f172a",
            }}
            formatter={(value) => [`${value} ms`, "Avg Response Time"]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="avgResponseTime"
            stroke="#0E7A88"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#responseTimeGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

