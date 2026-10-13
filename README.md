# GHT Job Manager (prototype)

Single-file prototype of the GHT job management system: Dashboard, Projects (with Eircode lookup and Google Maps), Quotes, Measurements, Teams, Materials, SEAI / NSAI Documents, Calendar and an AI assistant.

Built by Quantum Build Consultancy Ltd.

## Discovery Board (`discovery.html`)

Requirements workspace for the discovery session: per-module questions to tick off, status (Not started → Agreed), notes, sample documents (any file type) and voice notes recorded in the browser or uploaded. **Copy summary** turns everything into a structured list for the build spec.

### Storage

- **This browser (default):** saved on the device (IndexedDB), never uploaded to GitHub. **Export backup** / **Import backup** move it between devices.
- **Google Sheet (shared):** everyone sees the same board. Notes, answers, statuses and build items go to a Google Sheet; files and voice notes go to a Google Drive folder. Changes from others appear within 30 seconds.

### Connect the Google Sheet (10 minutes, once)

1. Create a Google Sheet, e.g. **GHT Discovery**, in the Google account that should own the data.
2. **Extensions → Apps Script**, replace the code with [`apps-script/Code.gs`](apps-script/Code.gs), save.
3. Choose **setup** in the function list and press **Run**. Approve the permissions. The execution log shows the **ACCESS KEY**.
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**. Copy the **Web app URL** (ends in `/exec`).
5. On the board press **Storage: this browser → Connect**, paste the URL and the key. If notes were saved in the browser first, press **Copy them to the Google Sheet**.

Share the URL and key privately with the people who should edit the board. They are never stored in this repo. To lock someone out, run **rotateKey** in Apps Script and send the new key to everyone else.
After changing Code.gs: **Deploy → Manage deployments → Edit → Version: New version**.

Live at `https://<your-github-user>.github.io/GHT/discovery.html`, also linked from the prototype's left rail.

## Deploy on GitHub Pages

1. Create a new repository (private is fine on a paid plan; public on free), e.g. `GHT`.
2. Upload `index.html` (and this README) to the root of the `main` branch.
3. Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
4. After a minute the site is live at `https://<your-github-user>.github.io/GHT/`.

## Settings (top of the script in `index.html`)

| Setting | What it does |
| --- | --- |
| `googleMapsKey` | Google Geocoding API key for live Eircode → address lookups. Restrict the key to your Pages domain (HTTP referrer) and to the Geocoding API only. Empty = built-in demo Eircodes. |
| `chatEndpoint` | URL of a proxy (e.g. the Cloudflare Worker) that accepts an Anthropic Messages API request body and returns the API response. Never put an API key in this file. Empty = the assistant button is hidden. |
| `chatModel` | Model sent to the proxy. |
| `demoToday` | Pins "today" so the sample jobs look current. Set to `null` to use the real date. |

## Notes

- Data is saved in each user's browser only (localStorage). It is not shared between people or devices. The live build moves data to Google Sheets and Drive.
- **Reset** in the left rail restores the sample data.
- Quotes print cleanly: Quotes → **Print / save as PDF** → choose "Save as PDF".
- Sample customers, addresses, Eircodes and rates are fictitious.
