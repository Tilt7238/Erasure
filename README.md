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
