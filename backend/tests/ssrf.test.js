const { isBlockedIp, validateUrlForMonitoring } = require("../utils/ssrfFilter");

describe("SSRF Protection & URL Validation", () => {
  test("identifies blocked private, loopback, and link-local IP addresses", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("127.0.0.2")).toBe(true);
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("10.255.255.255")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("192.168.0.254")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true); // AWS/GCP metadata
    expect(isBlockedIp("0.0.0.0")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true); // IPv6 loopback
    expect(isBlockedIp("fc00::1")).toBe(true); // IPv6 unique local
    expect(isBlockedIp("fe80::1")).toBe(true); // IPv6 link local
  });

  test("allows public IP addresses", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("142.250.190.46")).toBe(false);
  });

  test("rejects invalid or unsupported protocols", async () => {
    const ftp = await validateUrlForMonitoring("ftp://example.com/file");
    expect(ftp.valid).toBe(false);
    expect(ftp.error).toContain("HTTP and HTTPS");

    const file = await validateUrlForMonitoring("file:///etc/passwd");
    expect(file.valid).toBe(false);

    const ssh = await validateUrlForMonitoring("ssh://git@github.com");
    expect(ssh.valid).toBe(false);

    const invalid = await validateUrlForMonitoring("not-a-valid-url");
    expect(invalid.valid).toBe(false);
  });

  test("rejects localhost and cloud metadata hostnames directly", async () => {
    const localhost = await validateUrlForMonitoring("http://localhost:3000/api");
    expect(localhost.valid).toBe(false);
    expect(localhost.error).toContain("Access to localhost or internal");

    const metadata = await validateUrlForMonitoring("http://metadata.google.internal/computeMetadata/v1/");
    expect(metadata.valid).toBe(false);

    const cloudIp = await validateUrlForMonitoring("http://169.254.169.254/latest/meta-data/");
    expect(cloudIp.valid).toBe(false);

    const localSub = await validateUrlForMonitoring("http://service.local/health");
    expect(localSub.valid).toBe(false);
  });

  test("rejects dangerous or internal service ports", async () => {
    const sshPort = await validateUrlForMonitoring("http://example.com:22/health");
    expect(sshPort.valid).toBe(false);
    expect(sshPort.error).toContain("restricted for security");

    const dbPort = await validateUrlForMonitoring("http://example.com:27017/db");
    expect(dbPort.valid).toBe(false);

    const redisPort = await validateUrlForMonitoring("http://example.com:6379/data");
    expect(redisPort.valid).toBe(false);
  });

  test("allows localhost and loopback when allowLocal is true", async () => {
    const localhostRes = await validateUrlForMonitoring("http://localhost:4002/api/health", { allowLocal: true });
    expect(localhostRes.valid).toBe(true);

    const loopbackRes = await validateUrlForMonitoring("http://127.0.0.1:4002/api/health", { allowLocal: true });
    expect(loopbackRes.valid).toBe(true);

    // Dangerous port on localhost must STILL be blocked
    const dangerousLocal = await validateUrlForMonitoring("http://localhost:27017/db", { allowLocal: true });
    expect(dangerousLocal.valid).toBe(false);
    expect(dangerousLocal.error).toContain("restricted for security");

    // Cloud metadata must STILL be blocked
    const cloudMetadata = await validateUrlForMonitoring("http://169.254.169.254/latest/meta-data/", { allowLocal: true });
    expect(cloudMetadata.valid).toBe(false);
  });
});

