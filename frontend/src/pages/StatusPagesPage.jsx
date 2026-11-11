import React, { useState, useEffect, useCallback } from "react";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import {
  Globe,
  Plus,
  ExternalLink,
  Copy,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, getHeaders } from "../utils/formatters";

function suggestSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function StatusPagesPage() {
  const [pages, setPages] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Create/Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#0E7A88");
  const [isPublic, setIsPublic] = useState(true);
  const [showUrls, setShowUrls] = useState(false);
  const [showIncidents, setShowIncidents] = useState(true);
  const [selectedMonitorIds, setSelectedMonitorIds] = useState([]);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pagesRes, monRes] = await Promise.all([
        fetch(`${API_URL}/status-pages`, {
          headers: getHeaders(),
          credentials: "include",
        }),
        fetch(`${API_URL}/monitors?limit=100`, {
          headers: getHeaders(),
          credentials: "include",
        }),
      ]);
      const pagesJson = await pagesRes.json();
      const monJson = await monRes.json();
      if (!pagesRes.ok || !pagesJson.success) {
        throw new Error(pagesJson.error || "Failed to load status pages");
      }
      setPages(pagesJson.data || []);
      if (monJson.success && Array.isArray(monJson.data)) {
        setMonitors(monJson.data);
      }
    } catch (err) {
      setError(err.message || "Unable to fetch status pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingPage(null);
    setSlugTouched(false);
    setName("");
    setSlug("");
    setDescription("");
    setLogoUrl("");
    setAccentColor("#0E7A88");
    setIsPublic(true);
    setShowUrls(false);
    setShowIncidents(true);
    setSelectedMonitorIds(monitors.map((m) => m._id));
    setModalOpen(true);
  };

  const openEditModal = (page) => {
    setEditingPage(page);
    setSlugTouched(true);
    setName(page.name || "");
    setSlug(page.slug || "");
    setDescription(page.description || "");
    setLogoUrl(page.logoUrl || "");
    setAccentColor(page.accentColor || "#0E7A88");
    setIsPublic(page.isPublic !== false);
    setShowUrls(Boolean(page.showUrls));
    setShowIncidents(page.showIncidents !== false);
    setSelectedMonitorIds(
      Array.isArray(page.monitorIds)
        ? page.monitorIds.map((m) => (typeof m === "object" ? m._id : m))
        : []
    );
    setModalOpen(true);
  };

  const toggleMonitorSelection = (id) => {
    setSelectedMonitorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim(),
        logoUrl: logoUrl.trim(),
        accentColor: accentColor.trim() || "#0E7A88",
        isPublic,
        showUrls,
        showIncidents,
        monitorIds: selectedMonitorIds,
      };

      const url = editingPage
        ? `${API_URL}/status-pages/${editingPage._id}`
        : `${API_URL}/status-pages`;
      const method = editingPage ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save status page");
      }

      toast.success(
        editingPage ? "Status page updated" : "Public status page created"
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || "Could not save status page");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/status-pages/${deleteTarget._id}`, {
        method: "DELETE",
        headers: getHeaders(),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete status page");
      }
      toast.success("Status page deleted");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Could not delete status page");
    } finally {
      setDeleting(false);
    }
  };

  const copyPublicUrl = async (page) => {
    const shareUrl = `${window.location.origin}/status/${page.slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(page._id);
      toast.success("Public status link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Public Status Pages
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish branded, customer-facing service health pages without exposing sensitive configuration.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white hover:bg-[#0a5f6a] transition-colors self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Status Page
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white"
          >
            Retry
          </button>
        </Card>
      ) : pages.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No Public Status Pages Yet"
          description="Create a shareable status page to show live uptime, daily availability bars, and incident updates to your users."
          actionLabel="Create Status Page"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pages.map((page) => {
            const attachedCount = Array.isArray(page.monitorIds)
              ? page.monitorIds.length
              : 0;
            const sharePath = `/status/${page.slug}`;
            return (
              <Card key={page._id} className="p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: page.accentColor || "#0E7A88" }}
                      >
                        {page.name?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {page.name}
                        </h3>
                        <p className="text-xs font-mono text-[#0E7A88] dark:text-[#38b2ac] truncate">
                          {sharePath}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          page.isPublic
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {page.isPublic ? (
                          <Unlock className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        {page.isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>

                  {page.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                      {page.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-500">
                    <span>
                      <strong>{attachedCount}</strong> monitor(s) linked
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {page.showUrls ? (
                        <Eye className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {page.showUrls ? "URLs visible" : "URLs hidden"}
                    </span>
                    <span>
                      {page.showIncidents ? "Incidents shown" : "Incidents hidden"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyPublicUrl(page)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {copiedId === page._id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy Link
                    </button>
                    {page.isPublic && (
                      <a
                        href={sharePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#e8f7f8] dark:bg-[#0E7A88]/20 text-[#0E7A88] dark:text-[#38b2ac] hover:opacity-90"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(page)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#0E7A88] hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit status page"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(page)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete status page"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPage ? "Edit Public Status Page" : "Create Public Status Page"}
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={handleSave}
          className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Page Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  if (!slugTouched && !editingPage) {
                    setSlug(suggestSlug(val));
                  }
                }}
                placeholder="Acme Cloud Status"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Public Slug * (/status/{slug || "slug"})
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="acme-cloud-status"
                className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Live availability and uptime history for our production APIs."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Brand Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Logo URL (Optional https://)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 accent-[#0E7A88]"
              />
              <span className="text-xs">
                <strong className="block text-slate-800 dark:text-slate-200">
                  Publicly Listed
                </strong>
                <span className="text-slate-500">Allow anyone with URL</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={showIncidents}
                onChange={(e) => setShowIncidents(e.target.checked)}
                className="mt-0.5 accent-[#0E7A88]"
              />
              <span className="text-xs">
                <strong className="block text-slate-800 dark:text-slate-200">
                  Show Incidents
                </strong>
                <span className="text-slate-500">Display recent outages</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={showUrls}
                onChange={(e) => setShowUrls(e.target.checked)}
                className="mt-0.5 accent-[#0E7A88]"
              />
              <span className="text-xs">
                <strong className="block text-slate-800 dark:text-slate-200">
                  Expose Target URLs
                </strong>
                <span className="text-slate-500">Off by default for privacy</span>
              </span>
            </label>
          </div>

          {/* Monitors selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Included Monitors ({selectedMonitorIds.length} selected)
            </label>
            {monitors.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                Create at least one monitor to display on your status page.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {monitors.map((m) => (
                  <label
                    key={m._id}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedMonitorIds.includes(m._id)}
                        onChange={() => toggleMonitorSelection(m._id)}
                        className="accent-[#0E7A88]"
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {m.name}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      {m.isActive ? m.currentStatus : "PAUSED"}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0E7A88] text-white hover:bg-[#0a5f6a] disabled:opacity-60"
            >
              {saving ? "Saving..." : editingPage ? "Save Changes" : "Publish Status Page"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Status Page"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Its public link /status/${deleteTarget?.slug} will stop working immediately.`}
        confirmText="Delete Page"
        loading={deleting}
      />
    </div>
  );
}

