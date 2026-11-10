const dns = require("dns").promises;
const ipaddr = require("ipaddr.js");

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
]);

const DANGEROUS_PORTS = new Set([
  21, 22, 23, 25, 53, 69, 110, 111, 135, 137, 138, 139, 143, 389, 445, 465,
  587, 993, 995, 1433, 1434, 1521, 2049, 2375, 2376, 3306, 3389, 5432, 5900,
  6379, 9200, 9300, 11211, 27017, 27018, 27019,
]);

/**
 * Checks if an IP string is private, loopback, link-local, multicast, or reserved.
 */
function isBlockedIp(ipString) {
  try {
    let addr = ipaddr.parse(ipString);

    // If it's an IPv4-mapped IPv6 address (::ffff:127.0.0.1), unmap it
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }

    const range = addr.range();
    const blockedRanges = [
      "loopback",
      "private",
      "linkLocal",
      "carrierGradeNat",
      "multicast",
      "reserved",
      "unspecified",
      "broadcast",
      "uniqueLocal", // IPv6 fc00::/7
    ];

    if (blockedRanges.includes(range)) {
      return true;
    }

    // Additional check for 0.0.0.0/8 or 127.0.0.0/8
    if (addr.kind() === "ipv4") {
      const octets = addr.toByteArray();
      if (octets[0] === 0 || octets[0] === 127) {
        return true;
      }
      if (octets[0] === 169 && octets[1] === 254) {
        return true; // AWS/GCP/Azure link-local metadata
      }
    }

    return false;
  } catch (err) {
    return true; // Unparseable IP is treated as unsafe
  }
}

/**
 * Validates a target URL before monitoring or pinging.
 * Prevents SSRF attacks to internal infrastructure, private subnets, cloud metadata, and restricted ports.
 */
async function validateUrlForMonitoring(urlString) {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, error: "URL is required" };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    return { valid: false, error: "Invalid URL format" };
  }

  // 1. Only allow HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS protocols are supported" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject empty or forbidden hostnames
  if (!hostname) {
    return { valid: false, error: "Hostname cannot be empty" };
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { valid: false, error: "Access to localhost or internal network hostnames is prohibited" };
  }

  // 3. Reject cloud metadata IP
  if (hostname === "169.254.169.254") {
    return { valid: false, error: "Access to cloud metadata endpoints is prohibited" };
  }

  // 4. Validate Port
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
  if (isNaN(port) || port < 1 || port > 65535) {
    return { valid: false, error: "Invalid port number" };
  }

  if (DANGEROUS_PORTS.has(port)) {
    return { valid: false, error: `Access to port ${port} is restricted for security` };
  }

  // 5. If hostname is already a raw IP (v4 or v6), check directly
  if (ipaddr.isValid(hostname)) {
    if (isBlockedIp(hostname)) {
      return { valid: false, error: "Access to private, loopback, or internal IP addresses is prohibited" };
    }
  } else {
    // 6. Perform DNS lookup to inspect resolved IPs
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        return { valid: false, error: "Failed to resolve hostname DNS" };
      }

      for (const entry of addresses) {
        if (isBlockedIp(entry.address)) {
          return {
            valid: false,
            error: "Hostname resolves to a private, loopback, or internal network address",
          };
        }
      }
    } catch (dnsErr) {
      return {
        valid: false,
        error: `DNS resolution failed: ${dnsErr.message || "Hostname could not be resolved"}`,
      };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

module.exports = {
  isBlockedIp,
  validateUrlForMonitoring,
};

