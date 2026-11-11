const { performance } = require("perf_hooks");
const { validateUrlForMonitoring } = require("../utils/ssrfFilter");

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/**
 * Execute a single HTTP probe against a target URL
 */
async function probeSingleMethod(url, method, headers = {}, body = null, timeoutSec = 15) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(timeoutSec, 3), 30) * 1000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchHeaders = new Headers();
    if (headers && typeof headers === "object") {
      Object.entries(headers).forEach(([k, v]) => {
        if (k && v !== undefined && v !== null && typeof k === "string") {
          fetchHeaders.set(k.trim(), String(v).trim());
        }
      });
    }

    if (!fetchHeaders.has("User-Agent")) {
      fetchHeaders.set("User-Agent", "PingPilot-Tester/1.0");
    }

    const fetchOptions = {
      method,
      headers: fetchHeaders,
      signal: controller.signal,
    };

    if (!["GET", "HEAD"].includes(method) && body) {
      fetchOptions.body = typeof body === "object" ? JSON.stringify(body) : String(body);
      if (!fetchHeaders.has("Content-Type")) {
        fetchHeaders.set("Content-Type", "application/json");
      }
    }

    let currentUrl = url;
    let redirectCount = 0;
    const maxRedirects = 3;
    let response;

    while (redirectCount <= maxRedirects) {
      response = await fetch(currentUrl, {
        ...fetchOptions,
        redirect: "manual",
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const locationHeader = response.headers?.get?.("location");
        if (!locationHeader) {
          break;
        }
        const nextUrl = new URL(locationHeader, currentUrl).toString();
        const redirectSsrf = await validateUrlForMonitoring(nextUrl);
        if (!redirectSsrf.valid) {
          throw new Error(`Redirect SSRF Blocked: ${redirectSsrf.error}`);
        }
        if (response.body && typeof response.body.cancel === "function") {
          await response.body.cancel().catch(() => {});
        }
        currentUrl = nextUrl;
        redirectCount += 1;
        continue;
      }

      break;
    }

    const responseTime = Math.round(performance.now() - startTime);

    // Extract headers
    const resHeaders = {};
    response.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    let rawBody = "";
    if (method !== "HEAD") {
      const text = await response.text();
      // Cap at 500KB to prevent excessive memory/payload issues
      rawBody = text.length > 500000 ? text.slice(0, 500000) + "\n... [TRUNCATED (exceeded 500KB)]" : text;
    }

    let isJson = false;
    let parsedBody = null;
    try {
      if (rawBody) {
        parsedBody = JSON.parse(rawBody);
        isJson = true;
      }
    } catch (_e) {
      isJson = false;
    }

    const sizeBytes = Buffer.byteLength(rawBody, "utf8");

    return {
      method,
      status: response.status,
      statusText: response.statusText || String(response.status),
      responseTime,
      sizeBytes,
      headers: resHeaders,
      body: rawBody,
      parsedBody: isJson ? parsedBody : null,
      isJson,
      error: null,
    };
  } catch (err) {
    const responseTime = Math.round(performance.now() - startTime);
    const isTimeout = err.name === "AbortError" || err.message?.includes("aborted");
    const isSsrfBlocked = Boolean(err.message && err.message.startsWith("Redirect SSRF Blocked:"));

    return {
      method,
      status: isSsrfBlocked ? 403 : isTimeout ? 504 : 502,
      statusText: isSsrfBlocked ? "SSRF Blocked" : isTimeout ? "Gateway Timeout" : "Request Failed",
      responseTime,
      sizeBytes: 0,
      headers: {},
      body: "",
      parsedBody: null,
      isJson: false,
      ssrfBlocked: isSsrfBlocked,
      error: isTimeout ? `Request timed out after ${timeoutSec}s` : err.message || "Network request failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Run API Probe / Tester
 * POST /api/tester/run
 */
async function testEndpoint(req, res, next) {
  try {
    const { url, method = "GET", headers = {}, body = null, timeout = 15 } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        error: "Target URL is required",
      });
    }

    // SSRF Validation
    const ssrfCheck = await validateUrlForMonitoring(url);
    if (!ssrfCheck.valid) {
      return res.status(400).json({
        success: false,
        error: `SSRF Blocked: ${ssrfCheck.error}`,
      });
    }

    const requestedMethod = (method || "GET").toUpperCase().trim();

    if (requestedMethod === "ALL") {
      // Execute all 7 HTTP methods in parallel
      const results = await Promise.all(
        ALLOWED_METHODS.map((m) => probeSingleMethod(url, m, headers, body, timeout))
      );

      return res.status(200).json({
        success: true,
        mode: "all",
        url,
        results,
      });
    }

    if (!ALLOWED_METHODS.includes(requestedMethod)) {
      return res.status(400).json({
        success: false,
        error: `Invalid HTTP method: ${requestedMethod}. Supported methods: ${ALLOWED_METHODS.join(", ")}, ALL`,
      });
    }

    const result = await probeSingleMethod(url, requestedMethod, headers, body, timeout);

    if (result.ssrfBlocked) {
      return res.status(403).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      mode: "single",
      url,
      result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  testEndpoint,
};

