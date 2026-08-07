// POST /api/send-results
// Body: {
//   email: "reader@example.com",
//   newsletterOptIn: true|false,
//   lists: { read: [...titles], want: [...titles], no: [...titles] }
// }
//
// Sends the reader their own "Reading Ledger" via Resend, and records
// their email + consent in Upstash Redis, separate from the anonymous
// vote tallies.
//
// Env vars required:
//   RESEND_API_KEY
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

const FROM_ADDRESS = "Bookmark & Burn <ledger@bookmarkandburn.com>"; // TODO: replace with your verified sending address
const REPLY_TO = "hello@bookmarkandburn.com"; // TODO: replace

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = (req.body && req.body.email || "").trim();
  const newsletterOptIn = !!(req.body && req.body.newsletterOptIn);
  const lists = (req.body && req.body.lists) || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const html = renderEmailHtml(lists);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      reply_to: REPLY_TO,
      to: [email],
      subject: "Your Reading Ledger — 50 Best Thrillers of the 21st Century",
      html,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error("Resend error:", errText);
    return res.status(502).json({ error: "Email failed to send" });
  }

  try {
    const record = { email, newsletterOptIn, sentAt: new Date().toISOString() };
    const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/sub:${email.toLowerCase()}`;
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      body: JSON.stringify(record),
    });
  } catch (e) {
    console.error("Failed to record consent:", e);
  }

  return res.status(200).json({ ok: true });
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function renderEmailHtml(lists) {
  const section = (title, items, note) => {
    if (!items || !items.length) return "";
    const rows = items.map(t => `<li style="margin:0 0 8px; font-family:Georgia,serif; font-size:15px; color:#262119;">${escapeHtml(t)}</li>`).join("");
    return `
      <h2 style="font-family:Georgia,serif; font-size:18px; color:#6E2430; margin:28px 0 4px;">${title}</h2>
      ${note ? `<p style="font-family:Georgia,serif; font-size:13px; color:#7a7266; margin:0 0 12px;">${note}</p>` : ""}
      <ul style="padding-left:20px; margin:0;">${rows}</ul>
    `;
  };

  return `
  <div style="background:#F1EAD9; padding:32px 20px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #e4dbc8; border-radius:6px; padding:32px;">
      <p style="font-family:'Courier New',monospace; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#A8823E; margin:0 0 6px;">Bookmark &amp; Burn</p>
      <h1 style="font-family:Georgia,serif; font-size:24px; color:#262119; margin:0 0 20px;">Your Reading Ledger</h1>
      <p style="font-family:Georgia,serif; font-size:15px; color:#514A3E; line-height:1.6;">Here's exactly what you told us about the NYT's 50 Best Thrillers of the 21st Century — keep this as your running TBR.</p>

      ${section("Already Read", lists.read, null)}
      ${section("Your TBR Pile", lists.want, "Save this list — it's your to-be-read stack.")}
      ${section("Not For You", lists.no, null)}

      <p style="font-family:Georgia,serif; font-size:14px; color:#514A3E; margin-top:32px;">Thanks for playing along. If you want more of this, we're at <a href="https://bookmarkandburn.substack.com" style="color:#6E2430;">bookmarkandburn.substack.com</a>.</p>

      <p style="text-align:center; margin:28px 0 4px;">
        <a href="https://ko-fi.com/bookmarkandburn" style="display:inline-block; font-family:'Courier New',monospace; font-size:13px; font-weight:bold; color:#ffffff; background:#6E2430; padding:10px 22px; border-radius:20px; text-decoration:none;">Buy us a coffee</a>
      </p>

      <p style="font-family:'Courier New',monospace; font-size:10px; color:#a39d8f; margin-top:28px; text-align:center;">You're receiving this because you asked Bookmark &amp; Burn to email you your reading ledger. Reply to this email if you'd rather not hear from us again.</p>
    </div>
  </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}
