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
