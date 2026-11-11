let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch (_e) {
  nodemailer = null;
}

let cachedTransporter = null;
let cachedConfigSignature = null;

function resolveMailConfig() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!smtpUser || !smtpPass) {
    return null;
  }

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    from: process.env.EMAIL_FROM || smtpUser,
    signature: `${smtpHost || "gmail"}:${smtpPort}:${smtpUser}`,
  };
}

function getTransporter(config) {
  if (!nodemailer || !config) return null;

  if (cachedTransporter && cachedConfigSignature === config.signature) {
    return cachedTransporter;
  }

  const transportOptions = config.smtpHost
    ? {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      }
    : {
        service: "gmail",
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      };

  cachedTransporter = nodemailer.createTransport({
    ...transportOptions,
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  cachedConfigSignature = config.signature;
  return cachedTransporter;
}

function isMailConfigured() {
  return Boolean(nodemailer && resolveMailConfig());
}

const sendMail = async (to, subject, html) => {
  // In automated test environment, resolve safely unless explicitly mocked
  if (process.env.NODE_ENV === "test") {
    return { messageId: "mock-message-id" };
  }

  if (!nodemailer) {
    throw new Error("Outbound email driver (nodemailer) is not installed");
  }

  const config = resolveMailConfig();
  if (!config) {
    throw new Error("Outbound email credentials (EMAIL_USER/EMAIL_PASS or SMTP_*) are not configured");
  }

  const transporter = getTransporter(config);
  const mailOptions = {
    from: config.from,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info || { messageId: "sent" };
  } catch (error) {
    console.error("Error sending email:", error?.message || error);
    throw error;
  }
};

sendMail.isMailConfigured = isMailConfigured;

module.exports = sendMail;
