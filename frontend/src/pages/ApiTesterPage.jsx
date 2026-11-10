import React, { useState } from "react";
import Card from "../components/common/Card";
import MonitorFormModal from "../components/monitors/MonitorFormModal";
import {
  Send,
  Sparkles,
  Layers,
  Copy,
  Check,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Code2,
  Table as TableIcon,
  RefreshCw,
  BookmarkPlus,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

const getHeaders = () => {
  const token = localStorage.getItem("pingpilot_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "ALL"];

const METHOD_COLORS = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900/60",
  POST: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/60",
  PATCH: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400 border-violet-200 dark:border-violet-900/60",
  DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900/60",
  HEAD: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/60",
  OPTIONS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60",
  ALL: "bg-[#e8f7f8] text-[#0E7A88] dark:bg-[#0E7A88]/20 dark:text-[#38b2ac] border-[#0E7A88]/30",
};

export default function ApiTesterPage() {
  const [url, setUrl] = useState("https://httpbin.org/get");
  const [method, setMethod] = useState("GET");
  const [activeReqTab, setActiveReqTab] = useState("headers"); // 'headers' | 'body' | 'params'
  const [activeResTab, setActiveResTab] = useState("body"); // 'body' | 'headers'
  const [loading, setLoading] = useState(false);

  // Request Headers (key-value list)
  const [headerRows, setHeaderRows] = useState([
    { key: "Accept", value: "application/json" },
  ]);

  // Request Body
  const [requestBody, setRequestBody] = useState("");

  // Response state
  const [responseMode, setResponseMode] = useState(null); // 'single' | 'all'
  const [singleResult, setSingleResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [selectedInspectMethod, setSelectedInspectMethod] = useState(null);
  const [copied, setCopied] = useState(false);

  // Monitor creation modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Direct fetch inside ApiTesterPage to run endpoint probe
  const handleSend = async (overrideMethod) => {
    const targetMethod = overrideMethod || method;

    if (!url.trim()) {
      toast.error("Please enter a target endpoint URL");
      return;
    }

    setLoading(true);
    setResponseMode(null);

    // Build headers object
    const headersObj = {};
    headerRows.forEach((row) => {
      if (row.key.trim()) {
        headersObj[row.key.trim()] = row.value.trim();
      }
    });

    try {
      const res = await fetch(`${API_URL}/tester/run`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          url: url.trim(),
          method: targetMethod,
          headers: headersObj,
          body: ["POST", "PUT", "PATCH"].includes(targetMethod) ? requestBody : null,
          timeout: 15,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Probe request failed");
        return;
      }

      if (data.mode === "all") {
        setResponseMode("all");
        setAllResults(data.results || []);
        setSelectedInspectMethod(data.results?.[0] || null);
        toast.success(`Completed scan across all 7 HTTP methods!`);
      } else {
        setResponseMode("single");
        setSingleResult(data.result);
        toast.success(`Received ${data.result.status} ${data.result.statusText}`);
      }
    } catch (err) {
      toast.error(err.message || "Failed to execute probe request");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBody = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Response copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(requestBody);
      setRequestBody(JSON.stringify(parsed, null, 2));
      toast.success("JSON formatted cleanly");
    } catch (_err) {
      toast.error("Invalid JSON format");
    }
  };

  // Direct fetch for creating monitor pre-filled from this test
  const handleSaveAsMonitor = async (formData) => {
    setModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/monitors`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Monitor "${data.monitor?.name}" created successfully!`);
        setIsAddModalOpen(false);
      } else {
        toast.error(data.error || "Failed to create monitor");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save monitor");
    } finally {
      setModalLoading(false);
    }
  };

  const activeInspectData = responseMode === "all" ? selectedInspectMethod : singleResult;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#0E7A88]/10 text-[#0E7A88]">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              API Endpoint Tester
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Test any HTTP endpoint ad-hoc, inspect response status & headers, or scan all methods simultaneously.
          </p>
        </div>

        {/* Quick Scan Button */}
        <button
          type="button"
          onClick={() => {
            setMethod("ALL");
            handleSend("ALL");
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0E7A88]/10 text-[#0E7A88] hover:bg-[#0E7A88]/20 transition-colors border border-[#0E7A88]/20 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <Layers className="w-4 h-4" />
          <span>Scan All Methods (7-in-1)</span>
        </button>
      </div>

      {/* Main Request Builder Card */}
      <Card className="p-5 space-y-4">
        {/* Method & URL Input Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Method Dropdown */}
          <div className="relative min-w-[130px]">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0E7A88] ${
                METHOD_COLORS[method] || "bg-slate-100 text-slate-700"
              }`}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {m === "ALL" ? "⚡ ALL METHODS" : m}
                </option>
              ))}
            </select>
          </div>

          {/* URL Input */}
          <div className="relative flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1/health"
              className="w-full py-2.5 px-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-[#0E7A88] hover:bg-[#0b636f] rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Probing...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{method === "ALL" ? "Run Scan" : "Send Request"}</span>
              </>
            )}
          </button>
        </div>

        {/* Request Tabs (Headers | Body) */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
          <div className="flex items-center gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveReqTab("headers")}
              className={`pb-1 font-medium transition-colors cursor-pointer ${
                activeReqTab === "headers"
                  ? "border-b-2 border-[#0E7A88] text-[#0E7A88] font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Headers ({headerRows.filter((r) => r.key.trim()).length})
            </button>
            {["POST", "PUT", "PATCH", "ALL"].includes(method) && (
              <button
                type="button"
                onClick={() => setActiveReqTab("body")}
                className={`pb-1 font-medium transition-colors cursor-pointer ${
                  activeReqTab === "body"
                    ? "border-b-2 border-[#0E7A88] text-[#0E7A88] font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Request Body (JSON)
              </button>
            )}
          </div>

          {/* Headers Tab Content */}
          {activeReqTab === "headers" && (
            <div className="pt-3 space-y-2">
              {headerRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={row.key}
                    placeholder="Header Key (e.g. Authorization)"
                    onChange={(e) => {
                      const updated = [...headerRows];
                      updated[idx].key = e.target.value;
                      setHeaderRows(updated);
                    }}
                    className="flex-1 py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0E7A88]"
                  />
                  <input
                    type="text"
                    value={row.value}
                    placeholder="Header Value (e.g. Bearer token123)"
                    onChange={(e) => {
                      const updated = [...headerRows];
                      updated[idx].value = e.target.value;
                      setHeaderRows(updated);
                    }}
                    className="flex-1 py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0E7A88]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderRows(headerRows.filter((_, i) => i !== idx));
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setHeaderRows([...headerRows, { key: "", value: "" }])}
                className="inline-flex items-center gap-1.5 text-xs text-[#0E7A88] font-medium hover:underline pt-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Header</span>
              </button>
            </div>
          )}

          {/* Body Tab Content */}
          {activeReqTab === "body" && ["POST", "PUT", "PATCH", "ALL"].includes(method) && (
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Enter raw JSON payload:</span>
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="hover:text-[#0E7A88] cursor-pointer transition-colors"
                >
                  Beautify / Format JSON
                </button>
              </div>
              <textarea
                rows={5}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder='{\n  "service": "PingPilot",\n  "status": "active"\n}'
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0E7A88]"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Response Section */}
      {responseMode === "all" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Multi-Method Scan Matrix
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xl font-mono">
                {url}
              </p>
            </div>

            {/* Quick 1-Click Save as Monitor if GET succeeded */}
            {allResults.some((r) => r.method === "GET" && r.status === 200) && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0E7A88] text-white hover:bg-[#0b636f] transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save as Monitor</span>
              </button>
            )}
          </div>

          {/* All Methods Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Response Time</th>
                  <th className="py-3 px-4">Payload Size</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {allResults.map((item) => {
                  const isSuccess = item.status >= 200 && item.status < 300;
                  const isRedirect = item.status >= 300 && item.status < 400;
                  const isClientErr = item.status >= 400 && item.status < 500;
                  const isSelected = selectedInspectMethod?.method === item.method;

                  return (
                    <tr
                      key={item.method}
                      onClick={() => setSelectedInspectMethod(item)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#e8f7f8]/50 dark:bg-[#0E7A88]/10"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${
                            METHOD_COLORS[item.method] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : isRedirect
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                              : isClientErr
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                          }`}
                        >
                          {item.status} {item.statusText}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.responseTime} ms
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {item.sizeBytes ? `${item.sizeBytes} B` : "—"}
                      </td>

                      <td className="py-3 px-4">
                        {item.error ? (
                          <span className="text-rose-500 text-xs truncate max-w-xs block">
                            {item.error}
                          </span>
                        ) : isSuccess ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                          </span>
                        ) : item.status === 405 ? (
                          <span className="text-slate-400 dark:text-slate-500">
                            Method Not Allowed
                          </span>
                        ) : (
                          <span className="text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Handled ({item.status})
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="text-xs text-[#0E7A88] dark:text-[#38b2ac] font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <span>{isSelected ? "Inspecting" : "View Details"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detailed Response Viewer Card (for Single Method OR Selected Inspect Item from Scan) */}
      {activeInspectData && (
        <Card className="p-5 space-y-4">
          {/* Response Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center flex-wrap gap-2.5">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${
                  METHOD_COLORS[activeInspectData.method] || "bg-slate-100 text-slate-700"
                }`}
              >
                {activeInspectData.method}
              </span>

              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                  activeInspectData.status >= 200 && activeInspectData.status < 300
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : activeInspectData.status >= 400 && activeInspectData.status < 500
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                }`}
              >
                {activeInspectData.status} {activeInspectData.statusText}
              </span>

              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#0E7A88]" />
                <span>{activeInspectData.responseTime} ms</span>
              </div>

              {activeInspectData.sizeBytes > 0 && (
                <span className="text-xs text-slate-400 font-mono">
                  • {activeInspectData.sizeBytes} bytes
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Save as Monitor Button */}
              {activeInspectData.status === 200 && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0E7A88]/10 text-[#0E7A88] hover:bg-[#0E7A88]/20 transition-colors border border-[#0E7A88]/20 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Save as Monitor</span>
                </button>
              )}

              {/* Copy Body Button */}
              {activeInspectData.body && (
                <button
                  type="button"
                  onClick={() => handleCopyBody(activeInspectData.body)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Response Sub-tabs: Body | Headers */}
          <div className="flex items-center gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveResTab("body")}
              className={`pb-1 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeResTab === "body"
                  ? "border-b-2 border-[#0E7A88] text-[#0E7A88] font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Response Body {activeInspectData.isJson ? "(JSON)" : "(Raw)"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveResTab("headers")}
              className={`pb-1 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeResTab === "headers"
                  ? "border-b-2 border-[#0E7A88] text-[#0E7A88] font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Response Headers ({Object.keys(activeInspectData.headers || {}).length})</span>
            </button>
          </div>

          {/* Body Viewer */}
          {activeResTab === "body" && (
            <div className="relative">
              {activeInspectData.error ? (
                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <XCircle className="w-4 h-4" /> Request Failed
                  </div>
                  <p>{activeInspectData.error}</p>
                </div>
              ) : activeInspectData.body ? (
                <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed select-all">
                  {activeInspectData.isJson
                    ? JSON.stringify(activeInspectData.parsedBody, null, 2)
                    : activeInspectData.body}
                </pre>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No response body returned (empty response or HEAD method).
                </div>
              )}
            </div>
          )}

          {/* Headers Viewer */}
          {activeResTab === "headers" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Header Name</th>
                    <th className="py-2.5 px-3">Header Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {Object.entries(activeInspectData.headers || {}).map(([key, val]) => (
                    <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-[#0E7A88] dark:text-[#38b2ac]">
                        {key}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 break-all">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Save as Monitor Modal pre-filled */}
      <MonitorFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleSaveAsMonitor}
        loading={modalLoading}
        initialData={{
          name: new URL(url.startsWith("http") ? url : `https://${url}`).hostname || "My Service",
          url: url.trim(),
          method: "GET",
          timeout: 15,
          expectedStatusCodes: [200],
          isActive: true,
        }}
      />
    </div>
  );
}

