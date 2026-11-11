const mongoose = require("mongoose");
const StatusPage = require("../models/StatusPage");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const Incident = require("../models/Incident");
const {
  isAdminUser,
  canAccessMonitor,
  canAccessOwnedResource,
} = require("../utils/ownership");

const PUBLIC_CACHE_TTL_MS = 30 * 1000;
const PUBLIC_CACHE_MAX_ENTRIES = 200;
const publicStatusCache = new Map();

function clearPublicStatusCache(slug = null) {
  if (slug) {
    publicStatusCache.delete(String(slug).toLowerCase());
    return;
  }
  publicStatusCache.clear();
}

function getCachedPublicStatus(slug) {
  const key = String(slug).toLowerCase();
  const entry = publicStatusCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    publicStatusCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCachedPublicStatus(slug, payload) {
  if (publicStatusCache.size >= PUBLIC_CACHE_MAX_ENTRIES) {
    const oldestKey = publicStatusCache.keys().next().value;
    if (oldestKey) publicStatusCache.delete(oldestKey);
  }
  publicStatusCache.set(String(slug).toLowerCase(), {
    payload,
    expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS,
  });
}

function isDbOrMockReady(model, method) {
  return (
    mongoose.connection.readyState === 1 ||
    Boolean(model && model[method] && model[method]._isMockFunction)
  );
}

function normalizeSlug(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateLogoUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === "") {
    return { valid: true, value: "" };
  }
  const trimmed = String(rawUrl).trim();
  if (trimmed.length > 500) {
    return { valid: false, error: "Logo URL cannot exceed 500 characters" };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Logo URL must use http or https protocol" };
    }
    return { valid: true, value: parsed.toString() };
  } catch {
    return { valid: false, error: "Invalid logo URL format" };
  }
}

async function verifyOwnedMonitors(user, monitorIds) {
  if (!Array.isArray(monitorIds)) {
    return { valid: false, error: "monitorIds must be an array of monitor IDs" };
  }

  const deduped = [];
  const seen = new Set();

  for (const rawId of monitorIds) {
    const strId = String(rawId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(strId)) {
      return { valid: false, error: `Invalid monitor ID: ${strId}` };
    }
    if (!seen.has(strId)) {
      seen.add(strId);
      deduped.push(strId);
    }
  }

  if (deduped.length === 0) {
    return { valid: true, monitorIds: [] };
  }

  const monitors = await Monitor.find({ _id: { $in: deduped } });
  const monitorMap = new Map(monitors.map((m) => [m._id.toString(), m]));

  for (const id of deduped) {
    const mon = monitorMap.get(id);
    if (!mon) {
      return { valid: false, error: `Monitor not found: ${id}`, statusCode: 404 };
    }
    if (!canAccessMonitor(user, mon)) {
      return {
        valid: false,
        error: "You do not have permission to include one or more selected monitors",
        statusCode: 403,
      };
    }
  }

  return { valid: true, monitorIds: deduped };
}

/**
 * List user-owned status pages (or all for admin).
 * GET /api/status-pages
 */
async function getStatusPages(req, res, next) {
  try {
    const filter = isAdminUser(req.user) ? {} : { userId: req.user._id };
    const query = StatusPage.find(filter).sort({ createdAt: -1 });
    const pages =
      typeof query.populate === "function"
        ? await query.populate("monitorIds", "name currentStatus isActive monitoringInterval")
        : await query;

    return res.status(200).json({
      success: true,
      count: pages.length,
      data: pages,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new status page.
 * POST /api/status-pages
 */
async function createStatusPage(req, res, next) {
  try {
    const {
      name,
      slug,
      description = "",
      logoUrl = "",
      accentColor = "#0E7A88",
      isPublic = true,
      showUrls = false,
      showIncidents = true,
      monitorIds = [],
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        error: "Status page name is required",
      });
    }

    const normalizedSlug = normalizeSlug(slug || name);
    if (
      normalizedSlug.length < 3 ||
      normalizedSlug.length > 60 ||
      !StatusPage.SLUG_REGEX.test(normalizedSlug)
    ) {
      return res.status(400).json({
        success: false,
        error: "Slug must be 3-60 lowercase alphanumeric characters or hyphens",
      });
    }

    if (StatusPage.RESERVED_SLUGS.has(normalizedSlug)) {
      return res.status(400).json({
        success: false,
        error: `Slug "${normalizedSlug}" is reserved and cannot be used`,
      });
    }

    if (accentColor && !StatusPage.HEX_COLOR_REGEX.test(String(accentColor).trim())) {
      return res.status(400).json({
        success: false,
        error: "Accent color must be a valid 6-digit hex code (e.g., #0E7A88)",
      });
    }

    const logoCheck = validateLogoUrl(logoUrl);
    if (!logoCheck.valid) {
      return res.status(400).json({
        success: false,
        error: logoCheck.error,
      });
    }

    const monCheck = await verifyOwnedMonitors(req.user, monitorIds);
    if (!monCheck.valid) {
      return res.status(monCheck.statusCode || 400).json({
        success: false,
        error: monCheck.error,
      });
    }

    const existingSlug = await StatusPage.findOne({ slug: normalizedSlug });
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        error: `A status page with slug "${normalizedSlug}" already exists`,
      });
    }

    const created = await StatusPage.create({
      userId: req.user._id,
      name: String(name).trim().slice(0, 120),
      slug: normalizedSlug,
      description: String(description || "").trim().slice(0, 500),
      logoUrl: logoCheck.value,
      accentColor: String(accentColor || "#0E7A88").trim(),
      isPublic: Boolean(isPublic),
      showUrls: Boolean(showUrls),
      showIncidents: Boolean(showIncidents),
      monitorIds: monCheck.monitorIds,
    });

    clearPublicStatusCache(created.slug);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "A status page with that slug already exists",
      });
    }
    next(error);
  }
}

/**
 * Update a status page owned by the authenticated user.
 * PATCH /api/status-pages/:id
 */
async function updateStatusPage(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status page ID",
      });
    }

    const page = await StatusPage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({
        success: false,
        error: "Status page not found",
      });
    }

    if (!canAccessOwnedResource(req.user, page.userId)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to modify this status page",
      });
    }

    const previousSlug = page.slug;
    const {
      name,
      slug,
      description,
      logoUrl,
      accentColor,
      isPublic,
      showUrls,
      showIncidents,
      monitorIds,
    } = req.body || {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({
          success: false,
          error: "Status page name cannot be empty",
        });
      }
      page.name = trimmed.slice(0, 120);
    }

    if (slug !== undefined) {
      const normalized = normalizeSlug(slug);
      if (
        normalized.length < 3 ||
        normalized.length > 60 ||
        !StatusPage.SLUG_REGEX.test(normalized)
      ) {
        return res.status(400).json({
          success: false,
          error: "Slug must be 3-60 lowercase alphanumeric characters or hyphens",
        });
      }
      if (StatusPage.RESERVED_SLUGS.has(normalized)) {
        return res.status(400).json({
          success: false,
          error: `Slug "${normalized}" is reserved`,
        });
      }
      if (normalized !== page.slug) {
        const collision = await StatusPage.findOne({
          slug: normalized,
          _id: { $ne: page._id },
        });
        if (collision) {
          return res.status(409).json({
            success: false,
            error: `A status page with slug "${normalized}" already exists`,
          });
        }
        page.slug = normalized;
      }
    }

    if (description !== undefined) {
      page.description = String(description || "").trim().slice(0, 500);
    }

    if (logoUrl !== undefined) {
      const logoCheck = validateLogoUrl(logoUrl);
      if (!logoCheck.valid) {
        return res.status(400).json({
          success: false,
          error: logoCheck.error,
        });
      }
      page.logoUrl = logoCheck.value;
    }

    if (accentColor !== undefined) {
      const trimmedColor = String(accentColor || "").trim();
      if (!StatusPage.HEX_COLOR_REGEX.test(trimmedColor)) {
        return res.status(400).json({
          success: false,
          error: "Accent color must be a valid 6-digit hex code",
        });
      }
      page.accentColor = trimmedColor;
    }

    if (isPublic !== undefined) page.isPublic = Boolean(isPublic);
    if (showUrls !== undefined) page.showUrls = Boolean(showUrls);
    if (showIncidents !== undefined) page.showIncidents = Boolean(showIncidents);

    if (monitorIds !== undefined) {
      const monCheck = await verifyOwnedMonitors(req.user, monitorIds);
      if (!monCheck.valid) {
        return res.status(monCheck.statusCode || 400).json({
          success: false,
          error: monCheck.error,
        });
      }
      page.monitorIds = monCheck.monitorIds;
    }

    await page.save();
    clearPublicStatusCache(previousSlug);
    clearPublicStatusCache(page.slug);

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "A status page with that slug already exists",
      });
    }
    next(error);
  }
}

/**
 * Delete a user-owned status page.
 * DELETE /api/status-pages/:id
 */
async function deleteStatusPage(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status page ID",
      });
    }

    const page = await StatusPage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({
        success: false,
        error: "Status page not found",
      });
    }

    if (!canAccessOwnedResource(req.user, page.userId)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to delete this status page",
      });
    }

    await StatusPage.findByIdAndDelete(req.params.id);
    clearPublicStatusCache(page.slug);

    return res.status(200).json({
      success: true,
      message: "Status page deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unauthenticated public endpoint returning sanitized live status, 30d daily history bars,
 * and active/recent incident timeline summaries without exposing owner emails, secrets,
 * or private monitor URLs unless explicitly permitted via showUrls.
 * GET /api/public/status/:slug
 */
async function getPublicStatusPageBySlug(req, res, next) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug || !StatusPage.SLUG_REGEX.test(slug)) {
      return res.status(404).json({
        success: false,
        error: "Status page not found",
      });
    }

    if (req.query.refresh !== "1") {
      const cached = getCachedPublicStatus(slug);
      if (cached) {
        return res.status(200).json({
          success: true,
          cached: true,
          data: cached,
        });
      }
    }

    const page = await StatusPage.findOne({ slug, isPublic: true });
    if (!page) {
      return res.status(404).json({
        success: false,
        error: "Status page not found",
      });
    }

    const monitorIds = Array.isArray(page.monitorIds) ? page.monitorIds : [];
    const monitors =
      monitorIds.length > 0 && isDbOrMockReady(Monitor, "find")
        ? await Monitor.find({ _id: { $in: monitorIds } }).select(
            "_id name url currentStatus isActive lastCheckedAt lastResponseTime monitoringInterval"
          )
        : [];

    const monObjectIds = monitors
      .map((m) =>
        typeof m._id === "string" && mongoose.Types.ObjectId.isValid(m._id)
          ? new mongoose.Types.ObjectId(m._id)
          : m._id
      )
      .filter(Boolean);

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let monitorStatsAgg = [];
    let dailyBarsAgg = [];

    if (monObjectIds.length > 0 && isDbOrMockReady(PingResult, "aggregate")) {
      [monitorStatsAgg, dailyBarsAgg] = await Promise.all([
        PingResult.aggregate([
          {
            $match: {
              monitorId: { $in: monObjectIds },
              checkedAt: { $gte: since30d },
            },
          },
          {
            $group: {
              _id: "$monitorId",
              totalChecks: { $sum: 1 },
              successfulChecks: {
                $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
              },
              avgResponseTime: { $avg: "$responseTime" },
            },
          },
        ]),
        PingResult.aggregate([
          {
            $match: {
              monitorId: { $in: monObjectIds },
              checkedAt: { $gte: since30d },
            },
          },
          {
            $group: {
              _id: {
                monitorId: "$monitorId",
                day: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$checkedAt",
                  },
                },
              },
              total: { $sum: 1 },
              up: {
                $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
              },
            },
          },
          { $sort: { "_id.day": 1 } },
        ]),
      ]);
    }

    const statsMap = new Map(
      (monitorStatsAgg || []).map((row) => [row._id.toString(), row])
    );

    const barsByMonitor = new Map();
    for (const row of dailyBarsAgg || []) {
      const mId = row._id?.monitorId?.toString?.();
      if (!mId) continue;
      if (!barsByMonitor.has(mId)) barsByMonitor.set(mId, []);
      barsByMonitor.get(mId).push({
        date: row._id.day,
        totalChecks: row.total || 0,
        uptimePercentage:
          row.total > 0 ? Number(((row.up / row.total) * 100).toFixed(2)) : null,
      });
    }

    let totalOverallChecks = 0;
    let totalOverallSuccess = 0;

    const publicServices = monitors.map((m) => {
      const idStr = m._id.toString();
      const stat = statsMap.get(idStr);
      const totalChecks = stat?.totalChecks || 0;
      const successfulChecks = stat?.successfulChecks || 0;

      totalOverallChecks += totalChecks;
      totalOverallSuccess += successfulChecks;

      const publicService = {
        id: idStr,
        name: m.name,
        status: !m.isActive ? "PAUSED" : m.currentStatus || "UNKNOWN",
        isActive: Boolean(m.isActive),
        lastCheckedAt: m.lastCheckedAt || null,
        avgResponseTime:
          stat?.avgResponseTime !== undefined && stat?.avgResponseTime !== null
            ? Math.round(stat.avgResponseTime)
            : m.lastResponseTime ?? null,
        uptimePercentage:
          totalChecks > 0
            ? Number(((successfulChecks / totalChecks) * 100).toFixed(2))
            : null,
        dailyBars: barsByMonitor.get(idStr) || [],
      };

      if (page.showUrls === true && m.url) {
        publicService.url = m.url;
      }

      return publicService;
    });

    const activeServices = publicServices.filter((s) => s.isActive);
    const downCount = activeServices.filter((s) => s.status === "DOWN").length;
    const upCount = activeServices.filter((s) => s.status === "UP").length;

    let overallStatus = "operational";
    if (activeServices.length === 0 || (upCount === 0 && downCount === 0)) {
      overallStatus = "unknown";
    } else if (downCount === activeServices.length) {
      overallStatus = "major_outage";
    } else if (downCount > 0) {
      overallStatus = "partial_outage";
    }

    const overallUptime =
      totalOverallChecks > 0
        ? Number(((totalOverallSuccess / totalOverallChecks) * 100).toFixed(2))
        : null;

    let publicIncidents = [];
    if (page.showIncidents !== false && monObjectIds.length > 0 && isDbOrMockReady(Incident, "find")) {
      const incQuery = Incident.find({
        monitorId: { $in: monObjectIds },
      });

      const incidents =
        typeof incQuery.sort === "function"
          ? await incQuery
              .sort({ isActive: -1, startedAt: -1 })
              .limit(15)
          : await incQuery;

      const monitorNameMap = new Map(monitors.map((m) => [m._id.toString(), m.name]));

      publicIncidents = (incidents || []).map((inc) => ({
        id: inc._id?.toString?.() || null,
        incidentKey: inc.incidentKey,
        title: inc.title,
        status: inc.status,
        isActive: Boolean(inc.isActive),
        monitorName: monitorNameMap.get(inc.monitorId?.toString?.()) || "Monitored Service",
        startedAt: inc.startedAt,
        resolvedAt: inc.resolvedAt || null,
        downtimeDurationMs: inc.downtimeDurationMs ?? null,
        timeline: Array.isArray(inc.timeline)
          ? inc.timeline.slice(-10).map((entry) => ({
              status: entry.status,
              message: entry.message,
              timestamp: entry.timestamp,
            }))
          : [],
      }));
    }

    const payload = {
      name: page.name,
      slug: page.slug,
      description: page.description || "",
      logoUrl: page.logoUrl || "",
      accentColor: page.accentColor || "#0E7A88",
      showUrls: Boolean(page.showUrls),
      showIncidents: page.showIncidents !== false,
      overallStatus,
      overallUptime,
      services: publicServices,
      incidents: publicIncidents,
      generatedAt: new Date().toISOString(),
    };

    setCachedPublicStatus(slug, payload);

    return res.status(200).json({
      success: true,
      cached: false,
      data: payload,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStatusPages,
  createStatusPage,
  updateStatusPage,
  deleteStatusPage,
  getPublicStatusPageBySlug,
  clearPublicStatusCache,
};

