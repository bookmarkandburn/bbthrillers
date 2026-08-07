// GET /api/results
// Returns: { total: number, books: { "1": {read, want, no}, ... } }

const RESULTS_KEY = "results";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${RESULTS_KEY}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    if (!r.ok) throw new Error("Upstash GET failed");
    const data = await r.json();
    const result = data.result ? JSON.parse(data.result) : { total: 0, books: {} };

    res.setHeader("Cache-Control", "public, max-age=15");
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Storage error" });
  }
}
