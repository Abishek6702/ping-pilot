const templates = {
  resetPassword: ({ firstName, resetUrl, expiresInMinutes = 15 }) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 15px;">Hello ${firstName || "User"},</p>
      <p style="color: #475569; font-size: 15px;">We received a request to reset your password. Click the button below to proceed:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">This link will expire in ${expiresInMinutes} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
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
