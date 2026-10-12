# Chrome Web Store listing

Assets and texts for the [Chrome Web Store](https://chrome.google.com/webstore/devconsole) entry.

## Images

| File | Use | Size |
|---|---|---|
| `screenshot-1-list.png` | Screenshot: list with search and filters | 1280×800 |
| `screenshot-2-by-video.png` | Screenshot: by-video view, unavailable videos | 1280×800 |
| `screenshot-3-delete.png` | Screenshot: deleting up to a date, with progress | 1280×800 |
| `promo-small-440x280.png` | Small promo tile | 440×280 |
| `promo-large-1400x560.png` | Large promo tile (marquee) | 1400×560 |

All are 24-bit PNG without alpha. The screenshots show the real manager window with made-up demo comments. The store icon is `chrome-ext/images/logo_128.png`.

## Listing

**Category:** Privacy & Security

**Summary** (from `manifest.json`): View, search and selectively delete your YouTube comments, live chat messages and community posts.

**Description (English):**

```
Delete your YouTube comments selectively — not just all-or-nothing.

Comment Deleter for YouTube loads your comments, live chat messages and community posts from Google "My Activity" and lets you choose exactly what to remove.

• Search and filter by date or year
• Group comments by video
• Find comments on private or deleted videos
• Delete single items, a whole video's comments or everything up to a date
• Export a CSV/JSON backup before deleting

Everything runs locally in your browser. No data is collected or sent anywhere.

Open source: https://github.com/Tilt7238/YoutubeCommentDeleter

Based on "Erasure" by Ian Campbell. Not affiliated with YouTube or Google.
```

**Description (German):**

```
Lösch deine YouTube-Kommentare gezielt — statt alles oder nichts.

Comment Deleter for YouTube lädt deine Kommentare, Livechat-Nachrichten und Community-Beiträge aus Googles „Meine Aktivitäten“. Du entscheidest genau, was weg soll.

• Suchen und nach Datum oder Jahr filtern
• Kommentare nach Video gruppieren
• Kommentare unter privaten oder gelöschten Videos finden
• Einzelne Einträge, alle zu einem Video oder alles bis zu einem Datum löschen
• Vorher ein Backup als CSV/JSON exportieren

Alles läuft lokal in deinem Browser. Es werden keine Daten erhoben oder übertragen.

Open Source: https://github.com/Tilt7238/YoutubeCommentDeleter

Basiert auf „Erasure“ von Ian Campbell. Keine Verbindung zu YouTube oder Google.
```

## Privacy tab

**Single purpose:**

```
Lets users view, search and delete their own YouTube comments, live chat messages and community posts from their Google My Activity history.
```

**Justification for `scripting`:**

```
The extension injects its own bundled content script (script.js, included in the package) into the user's Google My Activity tab, and only after the user clicks "Load list", "Delete selected" or "Quick delete" in the extension's window. The script reads the list of the user's own comments, live chat messages and community posts shown on that page so the extension can display, search and filter them, and it clicks the page's own delete buttons for exactly the entries the user selected. Without scripting, the extension cannot fulfil its single purpose.
```

**Justification for the host permission `https://myactivity.google.com/*`:**

```
The user's YouTube comment, live chat and community post history is only available on Google My Activity (myactivity.google.com). Host access is needed to inject the bundled script into that tab, read the user's own history entries and delete the entries the user selected. The extension requests access to this single host only and does not access any other website. All data is processed locally in the browser and never sent to the developer or any third party.
```

**Remote code:** No, I am not using remote code.

**Data usage — categories:** Personal communications, Website content.
Comment texts are personal communications, and the extension reads them from page content. Nothing is transmitted or stored, as the privacy policy explains; the categories are declared because the extension handles this data locally.

**Certifications:** tick all three.

**Privacy policy URL:** https://github.com/Tilt7238/YoutubeCommentDeleter/blob/master/PRIVACY.md
