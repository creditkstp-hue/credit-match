const BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts";
const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const AFFILIATE_LINK = "https://www.tkqlhce.com/click-101773653-13503362";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { success: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  try {
    if (!process.env.BREVO_API_KEY) {
      return json(500, { success: false, error: "Missing BREVO_API_KEY in Netlify environment variables." });
    }

    const payload = JSON.parse(event.body || "{}");
    const email = String(payload.email || "").trim().toLowerCase();
    if (payload.emailConsent !== true) {
      return json(400, { success: false, error: "Consent to email this assessment is required." });
    }
    if (payload.website) { // Honeypot field for automated submissions
      return json(400, { success: false, error: "Unable to process submission." });
    }
    const firstName = String(payload.firstName || "there").trim();
    const lastName = String(payload.lastName || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const score = payload.score || "Not provided";
    const recommendations = String(payload.recommendations || "").trim();
    if (recommendations.length > 7000 || firstName.length > 100 || lastName.length > 100 || email.length > 254) {
      return json(400, { success: false, error: "Submission exceeds permitted length." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { success: false, error: "A valid email address is required." });
    }

    const safeFirstName = escapeHtml(firstName);
    const safeRecommendations = escapeHtml(recommendations);
    const safeScore = escapeHtml(score);

    const headers = {
      "accept": "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json"
    };

    const contactResponse = await fetch(BREVO_CONTACTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        updateEnabled: true,
        attributes: {
          FIRSTNAME: firstName,
          LASTNAME: lastName,
          // Built-in Brevo contact fields; custom fields must be provisioned before use.
          // Marketing consent is deliberately NOT inferred from assessment delivery.
        }
      })
    });

    const contactData = await contactResponse.json().catch(() => ({}));
    if (!contactResponse.ok) {
      return json(500, {
        success: false,
        step: "save_contact",
        error: contactData.message || contactData.error || "Brevo did not save the contact."
      });
    }

    const emailResponse = await fetch(BREVO_EMAIL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender: {
          name: "Credit Match",
          email: process.env.BREVO_SENDER_EMAIL || "creditkstp@gmail.com"
        },
        to: [{ email, name: fullName || firstName }],
        subject: "Your Credit Match Educational Assessment",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:auto;">
            <h2>Hello ${safeFirstName},</h2>
            <p>Your Credit Match profile has been processed.</p>
            <p><strong>Self-reported credit score band:</strong> ${safeScore}</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin:16px 0;">
              <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;margin:0;">${safeRecommendations}</pre>
            </div>
            <p><strong>Optional next step:</strong> Compare the terms, risks, and costs of any service before deciding.</p>
            <p>
              <a href="${AFFILIATE_LINK}" style="background:#2563eb;color:white;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:bold;display:inline-block;">
                View Tradeline Options
              </a>
            </p>
            <p style="font-size:12px;color:#64748b;">Educational information only, not an approval, credit-score prediction, credit repair guarantee, or financial advice. Affiliate disclosure: Credit Match may earn a commission if you use a referral link. Authorized-user tradelines do not guarantee score improvements.</p>
          </div>
        `
      })
    });

    const emailData = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      return json(500, {
        success: false,
        step: "send_email",
        error: emailData.message || emailData.error || "Lead saved, but the email did not send."
      });
    }

    return json(200, {
      success: true,
      contactSaved: true,
      emailSent: true,
      affiliateLink: AFFILIATE_LINK,
      marketingConsentReceived: payload.marketingConsent === true,
      marketingAutomationEnabled: false
    });
  } catch (err) {
    return json(500, { success: false, error: err.message || "Unexpected server error." });
  }
};
