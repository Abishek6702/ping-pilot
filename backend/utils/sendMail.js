const nodemailer = require("nodemailer");

const sendMail = async (to, subject, html) => {
  // In test environment, skip outbound network calls and resolve immediately
  if (process.env.NODE_ENV === "test") {
    return { messageId: "mock-test-message-id" };
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
    console.error("Error sending email:", error);
    throw error; // ✅
  }
};

module.exports = sendMail;
