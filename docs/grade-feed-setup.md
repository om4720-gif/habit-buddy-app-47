# Keeping a grades link connected

1. **Set two secrets in Lovable** (Settings → Secrets, or your environment settings):
   - `GRADE_FEED_KEY`: 32 random bytes, base64 encoded. Make one with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `CRON_SECRET`: a long random string. The scheduler uses it to call the sync.
2. **Apply the migration** `supabase/migrations/20261023130000_grade_feeds.sql` (Lovable may do this on sync).
3. **Schedule the check.** Open `docs/grade-feed-schedule.sql`, replace `<YOUR_APP_URL>` and `<CRON_SECRET>`, and run it once in the Supabase SQL editor. Don't commit the filled-in version.
4. **Connect in the app:** Grades page → *Connected grades link* → paste the link → **Connect**.

Notes:
- The link is encrypted in the database. Only the host is shown in the app.
- A failed check is recorded as the status, for example "error: …", so you can see why.
- The scheduler runs every 3 hours. **Check now** runs a check immediately.
- Disconnect deletes the stored link.
