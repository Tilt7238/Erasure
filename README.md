<p align="center"><img src="chrome-ext/images/logo/logo.png" width="128" alt="Comment Deleter for YouTube logo"></p>

# Comment Deleter for YouTube

A Chrome extension to view, search and selectively delete your own YouTube history: comments, live chat messages and community posts.

It works on your [Google My Activity](https://myactivity.google.com/) pages, in your own browser. Nothing is sent anywhere — see the [privacy policy](PRIVACY.md).

## Features

- **Complete list** of your comments, live chat messages or community posts, with date, time, text and video.
- **Search** (Ctrl+F) with highlighted matches, **date range** filter and **year** shortcuts.
- **By video** view: all your comments grouped per video, with count and date range.
- **Unavailable videos**: comments on private, deleted or otherwise unavailable videos are marked and can be removed in one go.
- **Delete** single items (shift-click for ranges), everything shown, or everything up to a date — newest or oldest first.
- **Quick delete** everything (or everything up to a date) without loading the list first, for very large histories.
- **Export** the shown items as CSV or JSON as a backup before deleting.
- Progress bar with time estimate, Stop button, and a confirmation that names the date range before anything is deleted.

## Installation

**Chrome Web Store:** coming soon.

**Manually (developer mode):**

1. Download this repository (**Code → Download ZIP**) and unpack it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-ext` folder (the one containing `manifest.json`).
4. Pin the extension via the puzzle icon in the toolbar.

To update, unpack the new version into the same folder and click ↻ on the extension in `chrome://extensions`.

## Usage

1. Sign in to Google in Chrome.
2. Click the extension icon — the manager window opens.
3. Choose **Comments**, **Live chats** or **Community posts** and click **Load list**. The extension opens the matching My Activity page in a tab of your browser window and reads the whole list. Keep that tab in front while loading or deleting: hidden tabs don't render, so the work pauses until the tab is visible again.
4. Search, filter and select what you want to remove, then click **Delete selected**.

Deleted items cannot be restored — export a backup first if you might want them later.

## Permissions

- **Access to `myactivity.google.com`** — to read your history list and click its delete buttons on your behalf.
- **Scripting** — to run that logic inside the My Activity tab.

## Credits

This extension is a fork of [Erasure](https://github.com/ian-campbell/Erasure) by Ian Campbell, extended with the manager window, search, filters, by-video view, export and a new logo. Much of the new code was written with the help of [Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE.txt)
