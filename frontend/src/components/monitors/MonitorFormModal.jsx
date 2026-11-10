import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import toast from "react-hot-toast";

export default function MonitorFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  loading = false,
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    method: "GET",
    interval: 5,
    timeout: 15,
    expectedStatusCodes: "200",
    isActive: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        url: initialData.url || "",
        method: initialData.method || "GET",
        interval: initialData.interval || 5,
        timeout: initialData.timeout || 15,
        expectedStatusCodes: Array.isArray(initialData.expectedStatusCodes)
          ? initialData.expectedStatusCodes.join(", ")
          : "200",
        isActive: initialData.isActive !== false,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        url: "",
        method: "GET",
        interval: 5,
        timeout: 15,
        expectedStatusCodes: "200",
        isActive: true,
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return toast.error("Monitor name is required");
    }
    if (!formData.url.trim()) {
      return toast.error("Monitor URL is required");
    }

    try {
      const parsedUrl = new URL(formData.url.trim());
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return toast.error("URL must use HTTP or HTTPS protocol");
      }
    } catch (err) {
      return toast.error("Please enter a valid HTTP/HTTPS URL");
    }

    // Parse status codes
    const codes = formData.expectedStatusCodes
      .split(",")
      .map((c) => parseInt(c.trim(), 10))
      .filter((c) => !isNaN(c) && c >= 100 && c <= 599);

    if (codes.length === 0) {
      return toast.error("Please enter at least one valid HTTP status code (e.g. 200)");
    }

    const payload = {
      ...formData,
      url: formData.url.trim(),
      interval: Number(formData.interval) || 5,
      timeout: Number(formData.timeout) || 15,
      expectedStatusCodes: codes,
    };

    onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Monitor" : "Create New Monitor"}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Monitor Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Backend API Gateway"
            required
            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] focus:border-[#0E7A88] text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Backend URL *
          </label>
          <input
            type="url"
            name="url"
            value={formData.url}
            onChange={handleChange}
            placeholder="https://my-app.onrender.com/health"
            required
            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] focus:border-[#0E7A88] text-slate-900 dark:text-white"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Must be a public HTTP/HTTPS endpoint. Private IPs and localhost are protected against SSRF.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Description (Optional)
          </label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="e.g. Production user service keep-alive"
            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] focus:border-[#0E7A88] text-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Request Timeout (seconds)
            </label>
            <input
              type="number"
              name="timeout"
              value={formData.timeout}
              onChange={handleChange}
              min="1"
              max="60"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] focus:border-[#0E7A88] text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Expected Status Codes
            </label>
            <input
              type="text"
              name="expectedStatusCodes"
              value={formData.expectedStatusCodes}
              onChange={handleChange}
              placeholder="200, 201, 204"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] focus:border-[#0E7A88] text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActiveToggle"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="w-4 h-4 text-[#0E7A88] rounded-sm border-slate-300 dark:border-slate-700 focus:ring-[#0E7A88]"
          />
          <label htmlFor="isActiveToggle" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            Monitoring active (uncheck to pause checks)
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {initialData ? "Save Changes" : "Create Monitor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

