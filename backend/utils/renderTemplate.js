const templates = {
  resetPassword: ({ firstName, resetUrl, expiresInMinutes = 15 }) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 15px;">Hello ${firstName || "User"},</p>
      <p style="color: #475569; font-size: 15px;">We received a request to reset your password. Click the button below to proceed:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #0E7A88; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">This link will expire in ${expiresInMinutes} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `,

  serviceDown: ({ serviceName, url, failureCount, errorMessage, time }) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #ffffff;">
      <div style="margin-bottom: 16px;">
        <span style="background-color: #ef4444; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 12px; text-transform: uppercase;">
          ⚠️ Service Alert: DOWN
        </span>
      </div>
      <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">${serviceName} is Down</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
        PingPilot detected that your monitored service failed ${failureCount} consecutive check(s).
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #334155;"><strong>Target URL:</strong> <a href="${url}" style="color: #0E7A88; word-break: break-all;">${url}</a></p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #334155;"><strong>Error Detail:</strong> <span style="color: #ef4444; font-weight: 600;">${errorMessage || "Unexpected response"}</span></p>
        <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Detected At:</strong> ${time || new Date().toUTCString()}</p>
      </div>
      <p style="color: #94a3b8; font-size: 11px; margin: 0;">PingPilot Automated Keep-Alive & API Monitoring Platform</p>
    </div>
  `,

  serviceRecovered: ({ serviceName, url, responseTime, time }) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #d1fae5; border-radius: 12px; background-color: #ffffff;">
      <div style="margin-bottom: 16px;">
        <span style="background-color: #10b981; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 12px; text-transform: uppercase;">
          ✅ Service Recovered: UP
        </span>
      </div>
      <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">${serviceName} is Back Online</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
        PingPilot received a successful response and confirmed service recovery.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #334155;"><strong>Target URL:</strong> <a href="${url}" style="color: #0E7A88; word-break: break-all;">${url}</a></p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #334155;"><strong>Response Latency:</strong> ${responseTime ? responseTime + 'ms' : 'Normal'}</p>
        <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Restored At:</strong> ${time || new Date().toUTCString()}</p>
      </div>
      <p style="color: #94a3b8; font-size: 11px; margin: 0;">PingPilot Automated Keep-Alive & API Monitoring Platform</p>
    </div>
  `,
};

function renderTemplate(templateName, data) {
  const templateFn = templates[templateName];
  if (!templateFn) {
    throw new Error(`Template "${templateName}" not found`);
  }
  return templateFn(data);
}

module.exports = renderTemplate;
