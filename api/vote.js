// POST /api/vote
// Body: { votes: { "1": "read" | "want" | "no", ... } }
//
// Storage: Upstash Redis (REST API), the Vercel-native equivalent of
// what Cloudflare KV was doing. All 50 books' tallies live in ONE
// Redis key ("results") as a JSON blob — one GET + one SET per vote.
//
// Env vars required (Vercel project → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// (Create a free database at upstash.com, or add it via the Vercel
// Marketplace integration — either way you get these two values.)

const RESULTS_KEY = "results";
const VALID = new Set(["read", "want", "no"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const votes = req.body && req.body.votes;
  if (!votes || typeof votes !== "object") {
    return res.status(400).json({ error: "Missing votes" });
  }

  const clean = {};
  for (const [bookId, val] of Object.entries(votes)) {
    if (!VALID.has(val)) continue;
    const id = String(parseInt(bookId, 10));
    if (id === "NaN") continue;
    clean[id] = val;
  }
  if (Object.keys(clean).length === 0) {
    return res.status(400).json({ error: "No valid votes" });
  }

  try {
    const current = await redisGet(RESULTS_KEY, { total: 0, books: {} });

    for (const [id, val] of Object.entries(clean)) {
      if (!current.books[id]) current.books[id] = { read: 0, want: 0, no: 0 };
      current.books[id][val] = (current.books[id][val] || 0) + 1;
    }
    current.total = (current.total || 0) + 1;

    await redisSet(RESULTS_KEY, current);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Storage error" });
  }
}

async function redisGet(key, fallback) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!r.ok) throw new Error("Upstash GET failed");
  const data = await r.json();
  if (!data.result) return fallback;
  try {
    return JSON.parse(data.result);
  } catch {
    return fallback;
  }
}

async function redisSet(key, value) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error("Upstash SET failed");
}
