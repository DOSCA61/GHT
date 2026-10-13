# GHT Job Manager (prototype)

Single-file prototype of the GHT job management system: Dashboard, Projects (with Eircode lookup and Google Maps), Quotes, Measurements, Teams, Materials, SEAI / NSAI Documents, Calendar and an AI assistant.

Built by Quantum Build Consultancy Ltd.

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
