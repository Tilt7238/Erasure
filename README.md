# Erasure

Delete your YouTube comment history.

Add the Youtube Comment Deleter Chrome extension: 
https://chromewebstore.google.com/detail/youtube-comment-deleter/lkhceldiinefjkocccdmpgheheeddfmb

Or navigate to https://www.youtube.com/feed/history/comment_history and then paste the entire script from "script.js" in your javascript console.

See CONTRIBUTING.md for todo list.

Update 2.2.1:

Add progress bar and rate-limit handling. 



Update 2.3.0:

Optional date limit: delete only items dated on or before a chosen day (newer items are kept).
Optional oldest-first order: the whole list is loaded first, then deleted from the bottom up.
Item dates are read from the day headings of the My Activity list; if no date can be read, a date-limited run stops without deleting anything.
When pasting script.js into the console, set options first, e.g.
`window.__erasureOptions = { cutoffDate: "2024-12-31", oldestFirst: true };`

Update 2.4.0:

New manager page ("Open manager" in the popup): loads the complete list of comments, live chats or community posts into a table, where single items (shift-click for ranges), all items, or all items up to a date can be selected and deleted — oldest first if wanted. A text filter narrows the list.
The manager drives a My Activity tab in your browser window; keep that tab in front while loading or deleting (hidden tabs don't render, so the run pauses until the tab is visible again).
This needs access to myactivity.google.com (new host permission).

Update 2.4.1:

Fix wrong item dates: items below a day heading that can't be read are now "unknown date" instead of inheriting the previous heading's day. Year-less headings get the right year from the newest-first order, numeric dates (29.03.2015) are understood, and the manager names the headings it couldn't read.

Update 2.5.0:

The toolbar icon now opens the manager window directly (the small popup is gone); everything happens there:
- search (Ctrl+F) with highlighted matches, date range filter, year chips with counts, show filter (not deleted / selected / unknown date / skipped / deleted) and newest/oldest sort
- export the shown items as CSV or JSON as a backup before deleting
- progress bar with time estimate; the delete confirmation names the date range and warns about selected items hidden by filters
- quick delete: delete everything (or everything up to a date) without loading the list first — the former popup function
- "Open in My Activity" opens the history page in the browser

Update 2.6.0:

"By video" view: items grouped per video (or post) with count and date range, collapsible, sortable by number of items, date or title; one checkbox selects a video's items.
Items on removed, private or otherwise unavailable videos (no video link, or titles like "Deleted video") are marked "unavailable" and can be shown with the "Unavailable videos" filter — e.g. to delete them all at once.
