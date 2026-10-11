const deletionScript = "script.js";

// the three histories; the youtube.com URLs redirect to Google My Activity
const TYPES = {
  comments: {
    label: "comments",
    url: "https://www.youtube.com/feed/history/comment_history",
  },
  livechats: {
    label: "live chat messages",
    url: "https://www.youtube.com/feed/history/live_chat_history",
  },
  posts: {
    label: "community posts",
    url: "https://myactivity.google.com/page?utm_source=my-activity&hl=en&page=youtube_posts_activity",
  },
};

const ACTIVITY_URL = /^https:\/\/myactivity\.google\.com\//;

// how long the My Activity page may take to load (sign-in prompts included)
const LOAD_TIMEOUT = 60000;

let currentType = "comments"; // selected type tab
let listType = null; // type the loaded list belongs to
let items = []; // [{id, date, dateSource, time, text, title, url, full, status}] in page order
let rowsById = new Map(); // id -> {item, tr, cb, textTd, linkEl, stateTd}
let selected = new Set(); // selected item ids
let lastClickedId = null; // anchor for shift-click ranges

/* The My Activity tab the content script runs in. It lives in a normal
   browser window, active, because hidden tabs don't render and My
   Activity's infinite scroll stalls there. */
let worker = null; // {tabId, windowId}
let busy = null; // null | "opening" | "loading" | "deleting" | "quick"
let stale = false; // the worker document no longer holds the listed items
let pendingLoad = null; // navigation of the worker tab we are waiting for
let runInfo = null; // {total, started} of the running delete, for the ETA

// ---- small helpers ----

function loadSetting(key, fallback) {
  try {
    const v = localStorage.getItem("erasure." + key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem("erasure." + key, String(value));
  } catch (e) {
    // not remembered — harmless
  }
}

// "YYYY-MM-DD" -> local midnight in ms, or null
function parseIsoDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(+m[1], m[2] - 1, +m[3]).getTime() : null;
}

function isoDay(ms) {
  const d = new Date(ms);
  return (
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatDate(ms) {
  if (ms === null) {
    return "unknown date";
  }
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return s + " s";
  if (s < 3600) return Math.round(s / 60) + " min";
  return Math.floor(s / 3600) + " h " + Math.round((s % 3600) / 60) + " min";
}

// ---- status, progress + controls ----

function setStatus(text, isError) {
  statusLine.textContent = text;
  statusLine.classList.toggle("error", !!isError);
}

// fraction 0..1, or null for "working, total unknown"; hide when !visible
function setProgress(visible, fraction) {
  progress.hidden = !visible;
  progress.classList.toggle("indeterminate", visible && fraction === null);
  progressFill.style.width = fraction === null ? "" : Math.round(fraction * 100) + "%";
}

function pendingSelection() {
  return items.filter((it) => selected.has(it.id) && it.status !== "deleted");
}

function refresh() {
  const n = pendingSelection().length;
  const shown = shownRows();
  loadButton.disabled = !!busy;
  quickDelete.disabled = !!busy;
  stopButton.disabled = !busy || busy === "opening";
  showTabButton.disabled = !worker;
  deleteSelected.disabled = !!busy || stale || n === 0;
  deleteSelected.textContent = "Delete selected" + (n ? " (" + n + ")" : "");
  exportCsv.disabled = exportJson.disabled = shown.length === 0;
  typeTabs.querySelectorAll("button").forEach(function (b) {
    b.disabled = !!busy;
    b.classList.toggle("active", b.dataset.type === currentType);
  });

  const count = (status) => items.filter((it) => it.status === status).length;
  const parts = [];
  if (items.length) {
    parts.push(shown.length + " of " + items.length + " " + TYPES[listType].label + " shown");
    parts.push(selected.size + " selected");
    if (count("deleted")) parts.push(count("deleted") + " deleted");
    if (count("skipped")) parts.push(count("skipped") + " skipped");
  }
  if (stale) parts.push("list outdated — load it again before deleting");
  summary.textContent = parts.join(" · ");

  const selectable = shown.filter((r) => r.item.status !== "deleted");
  const shownSelected = selectable.filter((r) => selected.has(r.item.id)).length;
  toggleShown.checked = selectable.length > 0 && shownSelected === selectable.length;
  toggleShown.indeterminate = shownSelected > 0 && shownSelected < selectable.length;
}

// ---- list rendering ----

function cell(tr, className, text) {
  const td = document.createElement("td");
  td.className = className;
  if (text !== undefined) {
    td.textContent = text;
  }
  tr.appendChild(td);
  return td;
}

function renderList() {
  rows.textContent = "";
  rowsById.clear();
  lastClickedId = null;
  items.forEach(function (it) {
    const tr = document.createElement("tr");
    tr.dataset.id = it.id;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cell(tr, "check").appendChild(cb);
    const dateTd = cell(tr, "date", formatDate(it.date));
    dateTd.title = it.dateSource ? "From the heading “" + it.dateSource + "”" : "No date heading found";
    if (it.time) {
      dateTd.appendChild(document.createElement("br"));
      dateTd.appendChild(document.createTextNode(it.time));
    }
    const textTd = cell(tr, "text");
    textTd.title = it.full;
    const videoTd = cell(tr, "video");
    let linkEl = null;
    if (it.url) {
      linkEl = document.createElement("a");
      linkEl.href = it.url;
      linkEl.target = "_blank";
      linkEl.rel = "noopener";
      videoTd.appendChild(linkEl);
    }
    const stateTd = cell(tr, "state");
    rowsById.set(it.id, { item: it, tr, cb, textTd, linkEl, stateTd });
  });
  emptyNote.hidden = items.length > 0;
  emptyNote.textContent = "No items loaded.";
  renderYearChips();
  applyView(true);
}

const STATE_LABELS = { queued: "queued", deleted: "deleted", skipped: "skipped" };

function setItemStatus(id, status) {
  const row = rowsById.get(id);
  if (!row) {
    return;
  }
  row.item.status = status;
  row.tr.classList.remove("queued", "deleted", "skipped");
  if (status) {
    row.tr.classList.add(status);
  }
  row.stateTd.textContent = STATE_LABELS[status] || "";
  if (status === "deleted") {
    selected.delete(id);
    row.cb.checked = false;
    row.cb.disabled = true;
    row.tr.classList.remove("selected");
  }
}

function setSelected(id, on) {
  const row = rowsById.get(id);
  if (!row || row.item.status === "deleted") {
    return;
  }
  if (on) {
    selected.add(id);
  } else {
    selected.delete(id);
  }
  row.cb.checked = on;
  row.tr.classList.toggle("selected", on);
}

// ---- view: search, date range, show filter, sort ----

// write `text` into `el`, wrapping case-insensitive matches of q in <mark>
function highlight(el, text, q) {
  el.textContent = "";
  if (!q) {
    el.textContent = text;
    return;
  }
  const lower = text.toLowerCase();
  let pos = 0;
  let hit;
  while ((hit = lower.indexOf(q, pos)) >= 0) {
    el.appendChild(document.createTextNode(text.slice(pos, hit)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(hit, hit + q.length);
    el.appendChild(mark);
    pos = hit + q.length;
  }
  el.appendChild(document.createTextNode(text.slice(pos)));
}

let lastQuery = null;
let lastSort = null;

function matchesView(it, q, from, to, show) {
  if (q && !(it.text + " " + it.title + " " + it.full).toLowerCase().includes(q)) {
    return false;
  }
  if (from !== null || to !== null) {
    if (it.date === null || (from !== null && it.date < from) || (to !== null && it.date > to)) {
      return false;
    }
  }
  switch (show) {
    case "pending": return it.status !== "deleted";
    case "selected": return selected.has(it.id);
    case "undated": return it.date === null;
    case "skipped": return it.status === "skipped";
    case "deleted": return it.status === "deleted";
    default: return true;
  }
}

function applyView(force) {
  const q = searchText.value.trim().toLowerCase();
  const from = parseIsoDay(dateFrom.value);
  const to = parseIsoDay(dateTo.value);
  const show = showFilter.value;
  const sort = sortOrder.value;
  if (force || sort !== lastSort) {
    // page order is newest first
    const ordered = sort === "oldest" ? items.slice().reverse() : items;
    const frag = document.createDocumentFragment();
    ordered.forEach((it) => frag.appendChild(rowsById.get(it.id).tr));
    rows.appendChild(frag);
    lastSort = sort;
  }
  const rehighlight = force || q !== lastQuery;
  rowsById.forEach(function (r) {
    r.tr.hidden = !matchesView(r.item, q, from, to, show);
    if (rehighlight) {
      highlight(r.textTd, r.item.text || "(no text)", q);
      if (r.linkEl) {
        highlight(r.linkEl, r.item.title || r.item.url, q);
      }
    }
  });
  lastQuery = q;
  updateYearChips();
  if (items.length && shownRows().length === 0) {
    emptyNote.hidden = false;
    emptyNote.textContent = "Nothing matches the current search and filters.";
  } else {
    emptyNote.hidden = items.length > 0;
  }
  refresh();
}

// rows currently shown, in display order
function shownRows() {
  const out = [];
  for (const tr of rows.children) {
    if (!tr.hidden) {
      out.push(rowsById.get(tr.dataset.id));
    }
  }
  return out;
}

let searchTimer = null;
searchText.oninput = function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyView, 150);
};
dateFrom.onchange = dateTo.onchange = () => applyView();
showFilter.onchange = () => applyView();
sortOrder.onchange = function () {
  saveSetting("sort", sortOrder.value);
  applyView();
};
clearDates.onclick = function () {
  dateFrom.value = dateTo.value = "";
  applyView();
};

// year chips: counts per year; a click sets the date range to that year
function renderYearChips() {
  yearChips.textContent = "";
  if (!items.length) {
    return;
  }
  const counts = new Map();
  let undated = 0;
  items.forEach(function (it) {
    if (it.date === null) {
      undated++;
    } else {
      const y = new Date(it.date).getFullYear();
      counts.set(y, (counts.get(y) || 0) + 1);
    }
  });
  const chip = function (label, title, onclick, key) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.title = title;
    b.dataset.key = key;
    b.onclick = onclick;
    yearChips.appendChild(b);
  };
  chip("All years", "Any date", function () {
    dateFrom.value = dateTo.value = "";
    if (showFilter.value === "undated") showFilter.value = "all";
    applyView();
  }, "all");
  Array.from(counts.keys())
    .sort((a, b) => b - a)
    .forEach(function (y) {
      chip(y + " (" + counts.get(y) + ")", "Show only " + y, function () {
        dateFrom.value = y + "-01-01";
        dateTo.value = y + "-12-31";
        if (showFilter.value === "undated") showFilter.value = "all";
        applyView();
      }, String(y));
    });
  if (undated) {
    chip("Unknown date (" + undated + ")", "Items whose date heading couldn't be read", function () {
      dateFrom.value = dateTo.value = "";
      showFilter.value = "undated";
      applyView();
    }, "undated");
  }
}

function updateYearChips() {
  const from = dateFrom.value;
  const to = dateTo.value;
  let active = "";
  if (showFilter.value === "undated" && !from && !to) {
    active = "undated";
  } else if (!from && !to) {
    active = "all";
  } else if (from.slice(5) === "01-01" && to.slice(5) === "12-31" && from.slice(0, 4) === to.slice(0, 4)) {
    active = from.slice(0, 4);
  }
  yearChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.key === active));
}

// keyboard: Ctrl/Cmd+F searches, Esc clears the search
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    searchText.focus();
    searchText.select();
  } else if (e.key === "Escape" && document.activeElement === searchText && searchText.value) {
    searchText.value = "";
    applyView();
  }
});

// ---- selection ----

rows.addEventListener("click", function (e) {
  const cb = e.target;
  if (cb.type !== "checkbox") {
    return;
  }
  const id = cb.closest("tr").dataset.id;
  if (e.shiftKey && lastClickedId !== null) {
    // range over the rows currently shown, between anchor and this row
    const shown = shownRows();
    const a = shown.findIndex((r) => r.item.id === lastClickedId);
    const b = shown.findIndex((r) => r.item.id === id);
    if (a >= 0 && b >= 0) {
      shown.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((r) => setSelected(r.item.id, cb.checked));
    }
  }
  setSelected(id, cb.checked);
  lastClickedId = id;
  if (showFilter.value === "selected") {
    applyView();
  } else {
    refresh();
  }
});

selectShown.onclick = function () {
  shownRows().forEach((r) => setSelected(r.item.id, true));
  refresh();
};

deselectShown.onclick = function () {
  shownRows().forEach((r) => setSelected(r.item.id, false));
  applyView();
};

clearSelection.onclick = function () {
  Array.from(selected).forEach((id) => setSelected(id, false));
  applyView();
};

toggleShown.onclick = function () {
  const on = toggleShown.checked;
  shownRows().forEach((r) => setSelected(r.item.id, on));
  applyView();
};

// ---- export (backup before deleting) ----

function download(filename, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportRecords() {
  return shownRows().map(function (r) {
    const it = r.item;
    return {
      date: it.date === null ? "" : isoDay(it.date),
      time: it.time,
      text: it.text,
      video: it.title,
      url: it.url,
      status: it.status || "",
    };
  });
}

function exportName(ext) {
  return "erasure-" + listType + "-" + isoDay(Date.now()) + "." + ext;
}

exportCsv.onclick = function () {
  const recs = exportRecords();
  const cols = ["date", "time", "text", "video", "url", "status"];
  const quote = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [cols.join(",")].concat(recs.map((r) => cols.map((c) => quote(r[c])).join(",")));
  // BOM so Excel reads UTF-8
  download(exportName("csv"), "text/csv;charset=utf-8", "﻿" + lines.join("\r\n"));
  setStatus("Exported " + recs.length + " items as CSV.");
};

exportJson.onclick = function () {
  const recs = exportRecords();
  download(exportName("json"), "application/json", JSON.stringify(recs, null, 2));
  setStatus("Exported " + recs.length + " items as JSON.");
};

// ---- settings ----

oldestFirst.checked = loadSetting("oldestFirst", "true") === "true";
oldestFirst.onchange = () => saveSetting("oldestFirst", oldestFirst.checked);
quickOldest.checked = loadSetting("quickOldest", "false") === "true";
quickOldest.onchange = () => saveSetting("quickOldest", quickOldest.checked);
sortOrder.value = loadSetting("sort", "newest") === "oldest" ? "oldest" : "newest";
currentType = TYPES[loadSetting("type", "comments")] ? loadSetting("type", "comments") : "comments";
quickDate.max = dateFrom.max = dateTo.max = isoDay(Date.now());
quickClearDate.onclick = () => (quickDate.value = "");

function clearList() {
  items = [];
  selected.clear();
  listType = null;
  stale = false;
  renderList();
}

typeTabs.addEventListener("click", function (e) {
  const type = e.target.dataset && e.target.dataset.type;
  if (!type || busy || type === currentType) {
    return;
  }
  currentType = type;
  saveSetting("type", type);
  // the worker tab holds one list at a time; another type's list is
  // useless for deleting, so start clean
  clearList();
  setStatus("Click “Load list” to load your " + TYPES[type].label + ".");
  refresh();
});

// ---- worker tab ----

async function workerAlive() {
  if (!worker) {
    return false;
  }
  try {
    const tab = await chrome.tabs.get(worker.tabId);
    worker.windowId = tab.windowId;
    return true;
  } catch (e) {
    worker = null;
    return false;
  }
}

// the browser window behind the manager, or null
async function browserWindow() {
  const me = await chrome.windows.getCurrent();
  try {
    const w = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
    return w.id !== me.id && w.state !== "minimized" ? w : null;
  } catch (e) {
    return null;
  }
}

/* Open the worker as the active tab of the browser window, so it renders
   while the manager window floats above it. Without a usable browser
   window (or if the manager is itself a tab there), use a new window. */
async function createWorkerTab(url) {
  const me = await chrome.windows.getCurrent();
  const target = await browserWindow();
  let tab;
  if (target) {
    tab = await chrome.tabs.create({ windowId: target.id, url: url, active: true });
  } else {
    const w = await chrome.windows.create({ url: url, type: "normal", focused: false });
    tab = w.tabs[0];
  }
  chrome.windows.update(me.id, { focused: true });
  return { tabId: tab.id, windowId: tab.windowId };
}

// navigate (or create) the worker tab and wait until My Activity loaded
async function openWorker(url) {
  let timer;
  const loaded = new Promise(function (resolve, reject) {
    pendingLoad = { sawLoading: false, isNew: false, resolve: resolve };
    timer = setTimeout(function () {
      reject(
        new Error(
          "My Activity didn't load within " + LOAD_TIMEOUT / 1000 +
            " s. Are you signed in to Google in that tab? Sign in, then try again."
        )
      );
    }, LOAD_TIMEOUT);
  });
  try {
    if (await workerAlive()) {
      await chrome.tabs.update(worker.tabId, { url: url, active: true });
    } else {
      pendingLoad.isNew = true;
      worker = await createWorkerTab(url);
    }
    refresh();
    await loaded;
  } finally {
    clearTimeout(timer);
    pendingLoad = null;
  }
}

chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
  if (!worker || tabId !== worker.tabId) {
    return;
  }
  if (info.status === "loading") {
    if (pendingLoad) {
      pendingLoad.sawLoading = true;
    } else if (listType || busy) {
      // a new document: the listed ids and any running script are gone
      workerLost("The My Activity tab navigated away — load the list again.");
    }
  } else if (
    info.status === "complete" &&
    pendingLoad &&
    (pendingLoad.sawLoading || pendingLoad.isNew) &&
    tab.url &&
    ACTIVITY_URL.test(tab.url)
  ) {
    pendingLoad.resolve();
  }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  if (worker && tabId === worker.tabId) {
    worker = null;
    workerLost("The My Activity tab was closed — load the list again.");
  }
});

function workerLost(message) {
  if (busy === "opening") {
    return; // openWorker is still waiting and reports on its own
  }
  clearQueued();
  busy = null;
  runInfo = null;
  setProgress(false);
  if (listType) {
    stale = true;
  }
  setStatus(message, true);
  refresh();
}

async function inject(opts) {
  const target = { tabId: worker.tabId };
  // options first: both injections share the content script's world
  await chrome.scripting.executeScript({
    target: target,
    func: function (o) {
      window.__erasureOptions = o;
    },
    args: [opts],
  });
  await chrome.scripting.executeScript({ target: target, files: [deletionScript] });
}

showTabButton.onclick = async function () {
  if (await workerAlive()) {
    chrome.tabs.update(worker.tabId, { active: true });
    chrome.windows.update(worker.windowId, { focused: true });
  }
  refresh();
};

openActivity.onclick = async function () {
  const target = await browserWindow();
  if (target) {
    chrome.tabs.create({ windowId: target.id, url: TYPES[currentType].url, active: true });
    chrome.windows.update(target.id, { focused: true });
  } else {
    chrome.windows.create({ url: TYPES[currentType].url, type: "normal" });
  }
};

stopButton.onclick = function () {
  if (!worker) {
    return;
  }
  chrome.tabs.sendMessage(worker.tabId, { type: "erasure:stop" }, function (resp) {
    if (chrome.runtime.lastError || !resp) {
      workerLost("Nothing is running in the My Activity tab.");
    } else {
      setStatus("Stopping…");
    }
  });
};

// ---- load ----

loadButton.onclick = async function () {
  const type = currentType;
  busy = "opening";
  clearList();
  emptyNote.textContent = "Loading…";
  setStatus("Opening My Activity…");
  setProgress(true, null);
  refresh();
  try {
    await openWorker(TYPES[type].url);
    busy = "loading";
    listType = type;
    setStatus("Loading all " + TYPES[type].label + "…");
    refresh();
    await inject({ mode: "list" });
  } catch (e) {
    busy = null;
    listType = null;
    emptyNote.textContent = "No items loaded.";
    setProgress(false);
    setStatus(e.message || String(e), true);
    refresh();
  }
};

// ---- delete selected ----

function clearQueued() {
  items.forEach(function (it) {
    if (it.status === "queued") {
      setItemStatus(it.id, undefined);
    }
  });
}

function confirmText(list, what) {
  const dated = list.filter((it) => it.date !== null).map((it) => it.date);
  const lines = ["Permanently delete " + what + " from your YouTube history?"];
  if (dated.length) {
    lines.push(
      "Dates: " + formatDate(Math.min.apply(null, dated)) + " to " + formatDate(Math.max.apply(null, dated)) +
        (dated.length < list.length ? " (+ " + (list.length - dated.length) + " with unknown date)" : "")
    );
  }
  const hidden = list.filter((it) => rowsById.get(it.id).tr.hidden).length;
  if (hidden) {
    lines.push("⚠ " + hidden + " of them are hidden by the current search or filters.");
  }
  lines.push("", "This cannot be undone.");
  return lines.join("\n");
}

deleteSelected.onclick = async function () {
  const list = pendingSelection();
  if (!list.length) {
    return;
  }
  const what = list.length + " " + TYPES[listType].label;
  if (!confirm(confirmText(list, what))) {
    return;
  }
  if (!(await workerAlive())) {
    workerLost("The My Activity tab is gone — load the list again.");
    return;
  }
  list.forEach((it) => setItemStatus(it.id, "queued"));
  busy = "deleting";
  runInfo = { total: list.length, started: Date.now() };
  setStatus("Deleting " + what + "…");
  setProgress(true, 0);
  refresh();
  try {
    // bring the worker to the front of its window so it renders
    await chrome.tabs.update(worker.tabId, { active: true });
    await inject({ ids: list.map((it) => it.id), oldestFirst: oldestFirst.checked });
  } catch (e) {
    clearQueued();
    busy = null;
    setProgress(false);
    setStatus("Could not start deleting: " + (e.message || e), true);
    refresh();
  }
};

// ---- quick delete (no list) ----

quickDelete.onclick = async function () {
  const type = currentType;
  const cutoff = parseIsoDay(quickDate.value);
  const what = (cutoff === null ? "ALL your " : "all your ") + TYPES[type].label +
    (cutoff === null ? "" : " dated on or before " + formatDate(cutoff));
  if (!confirm("Quick delete " + what + "?\n\nThe list is not loaded or shown first. This cannot be undone.")) {
    return;
  }
  busy = "opening";
  clearList();
  setStatus("Opening My Activity…");
  setProgress(true, null);
  refresh();
  try {
    await openWorker(TYPES[type].url);
    busy = "quick";
    runInfo = { total: null, started: Date.now() };
    setStatus("Quick delete: starting…");
    refresh();
    await inject({ cutoffDate: quickDate.value || null, oldestFirst: quickOldest.checked });
  } catch (e) {
    busy = null;
    setProgress(false);
    setStatus(e.message || String(e), true);
    refresh();
  }
};

// ---- messages from the content script ----

function finishRun(text, isError) {
  clearQueued();
  busy = null;
  runInfo = null;
  setProgress(false);
  setStatus(text, isError);
}

function onProgress(p) {
  const paused = /paused/.test(p.detail || "");
  const pauseText = "Paused — bring the My Activity tab to the front (“Show worker tab”). ";
  if (p.state === "error") {
    if (busy === "loading") {
      listType = null;
      emptyNote.textContent = "No items loaded.";
    }
    finishRun("Error: " + p.detail, true);
  } else if (busy === "loading") {
    if (p.state === "done") {
      busy = null; // the items message arrived just before
      setProgress(false);
    } else {
      setStatus(paused ? pauseText : "Loading all " + TYPES[listType].label + "… " + p.detail);
    }
  } else if (busy === "deleting") {
    const done = p.deleted + p.skipped;
    const counts = p.deleted + " of " + runInfo.total + " deleted" + (p.skipped ? ", " + p.skipped + " skipped" : "");
    if (p.state === "done") {
      finishRun("Done: " + counts + (p.detail ? " — " + p.detail : ""));
    } else {
      const elapsed = Date.now() - runInfo.started;
      const eta = done > 0 ? " · about " + formatDuration((elapsed / done) * (runInfo.total - done)) + " left" : "";
      setProgress(true, done / runInfo.total);
      setStatus((paused ? pauseText : "Deleting… ") + counts + (paused ? "" : eta));
    }
  } else if (busy === "quick") {
    const counts = p.deleted + " deleted" + (p.skipped ? ", " + p.skipped + " skipped" : "");
    if (p.state === "done") {
      finishRun("Quick delete done: " + counts + (p.detail ? " — " + p.detail : "") + ". Load the list to see what's left.");
    } else if (p.state === "loading") {
      setStatus(paused ? pauseText : "Quick delete: loading the whole list first (oldest first)… " + p.detail);
    } else {
      setStatus((paused ? pauseText : "Quick delete: ") + counts + (p.detail && !paused ? " — " + p.detail : ""));
    }
  }
  refresh();
}

function onItems(msg) {
  items = msg.items.map((it) => Object.assign({}, it, { status: undefined }));
  selected.clear();
  stale = false;
  renderList();
  const unparsed = msg.unparsedHeadings || [];
  setStatus(
    "Loaded " + items.length + " " + TYPES[listType].label +
      (msg.complete ? "." : " — stopped early, the list is incomplete.") +
      (unparsed.length
        ? " Could not read " + unparsed.length + " date heading(s), e.g. “" +
          unparsed.slice(0, 3).join("”, “") +
          "” — items below them show “unknown date” and are left out of date filters."
        : ""),
    unparsed.length > 0
  );
  refresh();
}

chrome.runtime.onMessage.addListener(function (msg, sender) {
  // only the worker tab's script
  if (!msg || !worker || !sender.tab || sender.tab.id !== worker.tabId) {
    return;
  }
  if (msg.type === "erasure:progress") {
    onProgress(msg);
  } else if (msg.type === "erasure:items" && busy === "loading") {
    onItems(msg);
  } else if (msg.type === "erasure:item") {
    setItemStatus(msg.id, msg.result);
    refresh();
  }
});

renderList();
refresh();
