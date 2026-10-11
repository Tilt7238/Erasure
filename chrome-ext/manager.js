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
let items = []; // [{id, date, time, text, title, url, full, status}]
let rowsById = new Map(); // id -> {item, tr, cb, stateTd}
let selected = new Set(); // selected item ids
let lastClickedId = null; // anchor for shift-click ranges

/* The My Activity tab the content script runs in. It lives in a normal
   browser window, active, because hidden tabs don't render and My
   Activity's infinite scroll stalls there. */
let worker = null; // {tabId, windowId}
let busy = null; // null | "opening" | "loading" | "deleting"
let stale = false; // the worker document no longer holds the listed items
let pendingLoad = null; // navigation of the worker tab we are waiting for
let deleteTotal = 0;

// ---- status + controls ----

function setStatus(text, isError) {
  statusLine.textContent = text;
  statusLine.classList.toggle("error", !!isError);
}

function pendingSelection() {
  return items.filter(function (it) {
    return selected.has(it.id) && it.status !== "deleted";
  });
}

function refresh() {
  const n = pendingSelection().length;
  loadButton.disabled = !!busy;
  stopButton.disabled = busy !== "loading" && busy !== "deleting";
  showTabButton.disabled = !worker;
  deleteSelected.disabled = !!busy || stale || n === 0;
  deleteSelected.textContent = "Delete selected" + (n ? " (" + n + ")" : "");
  typeTabs.querySelectorAll("button").forEach(function (b) {
    b.disabled = !!busy;
    b.classList.toggle("active", b.dataset.type === currentType);
  });

  const deleted = items.filter((it) => it.status === "deleted").length;
  const skipped = items.filter((it) => it.status === "skipped").length;
  const undated = items.filter((it) => it.date === null).length;
  const parts = [];
  if (items.length) {
    parts.push(items.length + " " + TYPES[listType].label);
    parts.push(selected.size + " selected");
    if (deleted) parts.push(deleted + " deleted");
    if (skipped) parts.push(skipped + " skipped");
    if (undated) parts.push(undated + " without a readable date");
  }
  if (stale) parts.push("list outdated — load it again before deleting");
  summary.textContent = parts.join(" · ");

  const visible = visibleRows().filter((r) => r.item.status !== "deleted");
  const visibleSelected = visible.filter((r) => selected.has(r.item.id)).length;
  toggleVisible.checked = visible.length > 0 && visibleSelected === visible.length;
  toggleVisible.indeterminate = visibleSelected > 0 && visibleSelected < visible.length;
}

// ---- list rendering ----

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
  const frag = document.createDocumentFragment();
  items.forEach(function (it) {
    const tr = document.createElement("tr");
    tr.dataset.id = it.id;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cell(tr, "check").appendChild(cb);
    const dateTd = cell(tr, "date", formatDate(it.date));
    if (it.time) {
      dateTd.appendChild(document.createElement("br"));
      dateTd.appendChild(document.createTextNode(it.time));
    }
    const textTd = cell(tr, "text", it.text || "(no text)");
    textTd.title = it.full;
    const videoTd = cell(tr, "video");
    if (it.url) {
      const a = document.createElement("a");
      a.href = it.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = it.title || it.url;
      videoTd.appendChild(a);
    }
    const stateTd = cell(tr, "state");
    frag.appendChild(tr);
    rowsById.set(it.id, { item: it, tr: tr, cb: cb, stateTd: stateTd });
  });
  rows.appendChild(frag);
  emptyNote.hidden = items.length > 0;
  emptyNote.textContent = "No items loaded.";
  applyFilter();
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

function visibleRows() {
  return Array.from(rowsById.values()).filter((r) => !r.tr.hidden);
}

function applyFilter() {
  const q = filterText.value.trim().toLowerCase();
  rowsById.forEach(function (r) {
    const hay = (r.item.text + " " + r.item.title + " " + r.item.full).toLowerCase();
    r.tr.hidden = !!q && !hay.includes(q);
  });
  refresh();
}

// ---- selection ----

rows.addEventListener("click", function (e) {
  const cb = e.target;
  if (cb.type !== "checkbox") {
    return;
  }
  const id = cb.closest("tr").dataset.id;
  if (e.shiftKey && lastClickedId !== null) {
    // range over the rows currently shown, between anchor and this row
    const shown = visibleRows();
    const a = shown.findIndex((r) => r.item.id === lastClickedId);
    const b = shown.findIndex((r) => r.item.id === id);
    if (a >= 0 && b >= 0) {
      shown.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (r) {
        setSelected(r.item.id, cb.checked);
      });
    }
  }
  setSelected(id, cb.checked);
  lastClickedId = id;
  refresh();
});

selectAll.onclick = function () {
  visibleRows().forEach((r) => setSelected(r.item.id, true));
  refresh();
};

selectNone.onclick = function () {
  Array.from(selected).forEach((id) => setSelected(id, false));
  refresh();
};

toggleVisible.onclick = function () {
  const on = toggleVisible.checked;
  visibleRows().forEach((r) => setSelected(r.item.id, on));
  refresh();
};

filterText.oninput = applyFilter;

// replaces the selection with every shown item dated on or before the day
selectUpTo.onclick = function () {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cutoffDate.value);
  if (!m) {
    setStatus("Pick a date first.", true);
    return;
  }
  const cutoff = new Date(+m[1], m[2] - 1, +m[3]).getTime();
  Array.from(selected).forEach((id) => setSelected(id, false));
  let n = 0;
  visibleRows().forEach(function (r) {
    if (r.item.date !== null && r.item.date <= cutoff && r.item.status !== "deleted") {
      setSelected(r.item.id, true);
      n++;
    }
  });
  const undated = visibleRows().filter((r) => r.item.date === null).length;
  setStatus(
    "Selected " + n + " items up to " + formatDate(cutoff) +
      (undated ? " (" + undated + " without a readable date left out)" : "") + "."
  );
  refresh();
};

// ---- options ----

try {
  oldestFirst.checked = localStorage.getItem("erasure.oldestFirst") !== "false";
} catch (e) {
  // default stays checked
}
oldestFirst.onchange = function () {
  try {
    localStorage.setItem("erasure.oldestFirst", String(oldestFirst.checked));
  } catch (e) {
    // not remembered — harmless
  }
};

typeTabs.addEventListener("click", function (e) {
  const type = e.target.dataset && e.target.dataset.type;
  if (!type || busy || type === currentType) {
    return;
  }
  currentType = type;
  // the worker tab can only hold one list; a list of another type is
  // useless for deleting, so start clean
  items = [];
  selected.clear();
  listType = null;
  stale = false;
  renderList();
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

/* Open the worker as the active tab of the last focused browser window,
   so it renders while the manager window floats above it. If the manager
   itself is that window (opened as a tab), use a new window instead. */
async function createWorkerTab(url) {
  const me = await chrome.windows.getCurrent();
  let target = null;
  try {
    target = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  } catch (e) {
    // no normal window — create one below
  }
  let tab;
  if (target && target.id !== me.id && target.state !== "minimized") {
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
            " s. Are you signed in to Google in that tab? Sign in, then click “Load list” again."
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
    } else if (listType) {
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
  items = [];
  selected.clear();
  listType = null;
  stale = false;
  renderList();
  emptyNote.textContent = "Loading…";
  setStatus("Opening My Activity…");
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
    setStatus(e.message || String(e), true);
    refresh();
  }
};

// ---- delete ----

function clearQueued() {
  items.forEach(function (it) {
    if (it.status === "queued") {
      setItemStatus(it.id, undefined);
    }
  });
}

deleteSelected.onclick = async function () {
  const ids = pendingSelection().map((it) => it.id);
  if (!ids.length) {
    return;
  }
  const what = ids.length + " " + TYPES[listType].label;
  if (!confirm("Permanently delete " + what + " from your YouTube history?\nThis cannot be undone.")) {
    return;
  }
  if (!(await workerAlive())) {
    workerLost("The My Activity tab is gone — load the list again.");
    return;
  }
  ids.forEach((id) => setItemStatus(id, "queued"));
  busy = "deleting";
  deleteTotal = ids.length;
  setStatus("Deleting " + what + "…");
  refresh();
  try {
    // bring the worker to the front of its window so it renders
    await chrome.tabs.update(worker.tabId, { active: true });
    await inject({ ids: ids, oldestFirst: oldestFirst.checked });
  } catch (e) {
    clearQueued();
    busy = null;
    setStatus("Could not start deleting: " + (e.message || e), true);
    refresh();
  }
};

// ---- messages from the content script ----

function onProgress(p) {
  const paused = /paused/.test(p.detail || "");
  if (busy === "loading") {
    if (p.state === "error") {
      busy = null;
      listType = null;
      emptyNote.textContent = "No items loaded.";
      setStatus("Error: " + p.detail, true);
    } else if (p.state === "done") {
      busy = null; // the items message arrived just before
    } else {
      setStatus(
        (paused ? "Paused — bring the My Activity tab to the front. " : "Loading all " + TYPES[listType].label + "… ") +
          (paused ? "" : p.detail)
      );
    }
  } else if (busy === "deleting") {
    const counts = p.deleted + " of " + deleteTotal + " deleted" + (p.skipped ? ", " + p.skipped + " skipped" : "");
    if (p.state === "error") {
      clearQueued();
      busy = null;
      setStatus("Error: " + p.detail, true);
    } else if (p.state === "done") {
      clearQueued();
      busy = null;
      setStatus("Done: " + counts + (p.detail ? " — " + p.detail : ""));
    } else {
      setStatus(
        (paused ? "Paused — bring the My Activity tab to the front. " : "Deleting… ") +
          counts +
          (!paused && p.detail ? " — " + p.detail : "")
      );
    }
  }
  refresh();
}

function onItems(msg) {
  items = msg.items.map(function (it) {
    return Object.assign({}, it, { status: undefined });
  });
  selected.clear();
  lastClickedId = null;
  stale = false;
  renderList();
  setStatus(
    "Loaded " + items.length + " " + TYPES[listType].label +
      (msg.complete ? "." : " — stopped early, the list is incomplete.")
  );
  refresh();
}

chrome.runtime.onMessage.addListener(function (msg, sender) {
  // only the worker tab's script; popup-started runs elsewhere are ignored
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

// the popup focuses an already open manager instead of opening another
window.erasureFocus = function () {
  chrome.windows.getCurrent(function (w) {
    chrome.windows.update(w.id, { focused: true });
  });
};

refresh();
