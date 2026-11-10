const https = require("https");

/**
 * Verify Google ID Token using Google tokeninfo endpoint
 * Validates issuer, audience, and email_verified
 */
const verifyGoogleIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing or invalid Google ID token");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;

  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    
    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const payload = JSON.parse(data);
          if (res.statusCode !== 200 || payload.error) {
            return reject(new Error(payload.error_description || "Invalid Google ID token"));
          }

          // Verify audience if configured
          if (clientId && payload.aud !== clientId) {
            return reject(new Error("Token audience mismatch (GOOGLE_CLIENT_ID)"));
          }

          // Verify issuer
          if (
            payload.iss !== "accounts.google.com" &&
            payload.iss !== "https://accounts.google.com"
          ) {
            return reject(new Error("Invalid Google token issuer"));
          }

          // Verify email is verified
          if (payload.email_verified !== "true" && payload.email_verified !== true) {
            return reject(new Error("Google account email is not verified"));
          }

          resolve({
            googleId: payload.sub,
            email: payload.email.toLowerCase().trim(),
            firstName: payload.given_name || payload.name || "User",
            lastName: payload.family_name || "",
            profileImage: payload.picture || "",
          });
        } catch (e) {
          reject(new Error("Failed to parse Google token response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Failed to contact Google authentication service: ${err.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Google token verification timed out"));
    });
  });
};

module.exports = {
  verifyGoogleIdToken,
};

