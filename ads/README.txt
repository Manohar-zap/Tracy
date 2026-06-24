# College Ads Folder

Place poster images here and list them in `local-ads.json`, OR connect Google Sheets for dynamic ads.

## Local ads
Edit `local-ads.json`:
```json
{ "title": "Event Name", "imageUrl": "ads/your-poster.jpg", "linkUrl": "https://...", "active": true }
```

## Google Sheets (recommended)
1. Create a Google Form for new ad submissions.
2. Link form responses to a Google Sheet with columns: **title | imageUrl | linkUrl | active**
3. In the Sheet: File → Share → Publish to web → CSV
4. Paste the CSV URL into `config.json` → `googleSheets.adsCsvUrl`
5. Paste your Form URL into `config.json` → `googleForms.submitAd`

## Popup behavior
- Ads show once per browser session on site load.
- If **more than 2 ads** exist, users must swipe through all slides before the close (×) button appears.
- With 2 or fewer ads, close is available immediately.

## Sample posters
`sample-ad-1.svg` and `sample-ad-2.svg` are included as placeholders.
