let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch (_e) {
  nodemailer = null;
}

const sendMail = async (to, subject, html) => {
  // In test environment or if nodemailer is not installed, resolve safely
  if (process.env.NODE_ENV === "test" || !nodemailer) {
    return { messageId: "mock-message-id" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error.message || error);
    throw error;
  }
};

module.exports = sendMail;
