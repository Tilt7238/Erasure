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
Clean up your YouTube history — selectively, not just all-or-nothing.

Comment Deleter for YouTube loads your complete list of YouTube comments, live chat messages and community posts from your Google "My Activity" page and lets you decide exactly what to remove.

FIND WHAT YOU WANT TO DELETE
• See all your comments with date, time, text and video
• Search with highlighted matches
• Filter by date range or jump to a year with one click
• "By video" view: all your comments grouped per video, with count and date range
• Find comments on private, deleted or unavailable videos and remove them in one go

DELETE THE WAY YOU WANT
• Single comments, a whole video's comments, everything shown, or everything up to a date
• Newest or oldest first
• Quick delete for very large histories — no need to load the list first
• Progress bar with time estimate and a Stop button
• A confirmation that shows the date range before anything is deleted

SAFE AND PRIVATE
• Export your comments as CSV or JSON as a backup before deleting
• Everything happens locally in your browser — no data is collected or sent anywhere
• No tracking, no ads, no account needed
• Open source on GitHub

HOW IT WORKS
Click the extension icon, choose comments, live chats or community posts and click "Load list". The extension opens your My Activity page in a tab and reads the list. Keep that tab visible while loading or deleting. Deleted comments cannot be restored, so export a backup first if you might want them later.

Based on the open-source project "Erasure" by Ian Campbell.
This extension is not affiliated with or endorsed by YouTube or Google.
```

**Description (German):**

```
Räum deinen YouTube-Verlauf auf — gezielt statt alles oder nichts.

Comment Deleter for YouTube lädt die komplette Liste deiner YouTube-Kommentare, Livechat-Nachrichten und Community-Beiträge aus deiner Google-Seite „Meine Aktivitäten“. Du entscheidest genau, was weg soll.

FINDEN, WAS WEG SOLL
• Alle Kommentare mit Datum, Uhrzeit, Text und Video
• Suche mit markierten Treffern
• Filter nach Zeitraum oder per Klick nach Jahr
• Ansicht „Nach Video“: alle Kommentare pro Video gruppiert, mit Anzahl und Zeitraum
• Kommentare unter privaten, gelöschten oder nicht verfügbaren Videos finden und gesammelt entfernen

LÖSCHEN, WIE DU WILLST
• Einzelne Kommentare, alle zu einem Video, alles Angezeigte oder alles bis zu einem Datum
• Neueste oder älteste zuerst
• Schnelllöschen für sehr große Verläufe, ohne die Liste vorher zu laden
• Fortschrittsbalken mit Restzeit und Stopp-Taste
• Bestätigung mit Zeitraum, bevor irgendetwas gelöscht wird

SICHER UND PRIVAT
• Export als CSV oder JSON als Backup vor dem Löschen
• Alles läuft lokal in deinem Browser — es werden keine Daten erhoben oder übertragen
• Kein Tracking, keine Werbung, kein Konto nötig
• Open Source auf GitHub

SO FUNKTIONIERT ES
Erweiterungs-Symbol anklicken, Kommentare, Livechats oder Community-Beiträge wählen und auf „Load list“ klicken. Die Erweiterung öffnet deine „Meine Aktivitäten“-Seite in einem Tab und liest die Liste. Lass diesen Tab beim Laden und Löschen sichtbar. Gelöschte Kommentare lassen sich nicht wiederherstellen, exportiere vorher ein Backup, falls du sie noch brauchst.

Basiert auf dem Open-Source-Projekt „Erasure“ von Ian Campbell.
Diese Erweiterung steht in keiner Verbindung zu YouTube oder Google.
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
