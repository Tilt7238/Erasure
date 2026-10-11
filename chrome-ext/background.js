// The toolbar icon opens the manager window (or focuses the open one).
// It floats above the browser window, so the My Activity tab the manager
// works in stays visible — and keeps rendering — behind it.

const MANAGER_URL = chrome.runtime.getURL("manager.html");

// window id of the manager this worker opened; the worker can be restarted,
// so getContexts() below is the fallback that survives that
let managerWindowId = null;
let opening = null; // the create in progress — a double click must not open two

async function focusExisting() {
  if (managerWindowId !== null) {
    try {
      await chrome.windows.update(managerWindowId, { focused: true });
      return true;
    } catch (e) {
      managerWindowId = null; // closed
    }
  }
  const open = await chrome.runtime.getContexts({
    contextTypes: ["TAB"],
    documentUrls: [MANAGER_URL],
  });
  if (open.length && open[0].windowId >= 0) {
    managerWindowId = open[0].windowId;
    await chrome.windows.update(managerWindowId, { focused: true });
    return true;
  }
  return false;
}

async function createManager() {
  // centered over the current browser window, leaving its edges visible
  const bounds = {};
  try {
    const w = await chrome.windows.getLastFocused();
    if (w.width && w.height) {
      bounds.width = Math.max(900, Math.round(w.width * 0.85));
      bounds.height = Math.round(w.height * 0.85);
      bounds.left = w.left + Math.round((w.width - bounds.width) / 2);
      bounds.top = w.top + Math.round((w.height - bounds.height) / 2);
    }
  } catch (e) {
    // no window to size against — use Chrome's default size
  }
  const win = await chrome.windows.create(Object.assign({ url: MANAGER_URL, type: "popup" }, bounds));
  managerWindowId = win.id;
}

async function openManager() {
  if (opening) {
    return opening;
  }
  opening = (async function () {
    if (!(await focusExisting())) {
      await createManager();
    }
  })();
  try {
    await opening;
  } finally {
    opening = null;
  }
}

chrome.action.onClicked.addListener(openManager);
