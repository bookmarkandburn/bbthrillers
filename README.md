# The Ledger — Bookmark & Burn Thriller Survey (Vercel version)

Same site, rebuilt for Vercel. The frontend (`index.html`) is
unchanged — it already calls `/api/vote`, `/api/results`, and
`/api/send-results`, which is exactly Vercel's own convention: any
`.js` file directly inside `/api` at the repo root is auto-detected as
a serverless function. No nested `functions/api` folder to get wrong,
no separate Root Directory setting to configure.

## What's in here

```
index.html            the entire site (HTML + CSS + JS, no build step)
package.json           enables ES module syntax ("type": "module") for the functions below
api/vote.js            records a submission
api/results.js         returns aggregated tallies
api/send-results.js    emails the reader their own ledger + TBR list
```

## Storage: Upstash Redis (instead of Cloudflare KV)

Vercel doesn't ship a built-in key-value store the way Cloudflare Pages
does, so this uses **Upstash Redis** via its REST API — a single
`fetch()` call per read/write, same shape as the Cloudflare version,
free tier comfortably covers this traffic.

1. Go to vercel.com → your project → **Storage** tab → **Create
   Database** → choose **Upstash / Redis** (or create one directly at
   upstash.com — either way ends up in the same place).
2. Once created, copy the two values it gives you:
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. If you created it via the Vercel Storage tab, these get added to
   your project's Environment Variables automatically. If you created
   it directly on upstash.com, add both manually: Project → Settings
   → Environment Variables.

## Email: Resend (unchanged from the Cloudflare version)

1. Create a Resend account, verify a sending domain.
2. Project → Settings → Environment Variables → add `RESEND_API_KEY`.
3. Open `api/send-results.js` and replace the two `TODO` placeholders
   — `FROM_ADDRESS` and `REPLY_TO` — with real addresses on your
   verified domain.

## Deploy steps

1. Push this folder's contents to a GitHub repo (everything at the
   repo root — `index.html`, `package.json`, and `api/` all sitting
   side by side, not nested inside another folder).
2. On vercel.com: **Add New → Project → Import** that repo.
3. Framework preset: leave as **Other** / no framework — this is a
   static site with serverless functions, no build step needed.
4. Add the three environment variables above (`UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`) before or right after
   the first deploy — they need to exist for the functions to work,
   but you can add them and redeploy if you forget.
5. Deploy. Vercel gives you a `<project-name>.vercel.app` URL by
   default — name the project `bbthrillers` if you want
   `bbthrillers.vercel.app`.
6. Test: submit a vote, confirm `/api/results` reflects it, and check
   the email if you opted in.

## Customizing

Same as before — book list, Ko-fi link, and colors are all in
`index.html`. See the comments in that file for exactly where.
