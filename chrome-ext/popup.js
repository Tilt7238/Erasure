const deletionScript = "script.js";

// pages the deletion script knows how to operate on: Google My Activity,
// or the youtube.com history URLs that redirect there
const HISTORY_URL_PATTERNS = [
  /^https:\/\/myactivity\.google\.com\//,
  /^https:\/\/www\.youtube\.com\/feed\/history\//,
];

function isHistoryPage(url) {
  return (
    !!url &&
    HISTORY_URL_PATTERNS.some(function (re) {
      return re.test(url);
    })
  );
}

// ---- status line + stop control ----

function setStatus(text, isError) {
  statusText.textContent = text;
  statusText.style.color = isError ? "#ff8a80" : "#ffffff";
}

function renderProgress(p) {
  if (!p || !p.state) {
    return;
  }
  var counts =
    p.deleted + " deleted" + (p.skipped ? ", " + p.skipped + " skipped" : "");
  var detail = p.detail ? " — " + p.detail : "";
  if (p.state === "running") {
    setStatus("Running: " + counts + detail);
  } else if (p.state === "loading") {
    setStatus("Loading the whole list (oldest first)… " + p.detail);
  } else if (p.state === "scrolling") {
    setStatus("Loading more items… " + counts + detail);
  } else if (p.state === "done") {
    setStatus("Done: " + counts + detail);
  } else if (p.state === "error") {
    setStatus("Error" + (p.detail ? ": " + p.detail : " — see page console"), true);
  }
}

// live progress broadcast by the injected script
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg && msg.type === "erasure:progress") {
    renderProgress(msg);
  }
});

function withActiveTab(fn) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0]) {
      fn(tabs[0]);
    }
  });
}

// on (re)open, ask the active tab where things stand; no receiver = no run
withActiveTab(function (tab) {
  chrome.tabs.sendMessage(tab.id, { type: "erasure:status" }, function (resp) {
    if (chrome.runtime.lastError || !resp) {
      setStatus("Idle");
      return;
    }
    renderProgress(resp);
  });
});

stopButton.onclick = function () {
  withActiveTab(function (tab) {
    chrome.tabs.sendMessage(tab.id, { type: "erasure:stop" }, function (resp) {
      if (chrome.runtime.lastError || !resp) {
        setStatus("Nothing running in this tab");
      } else {
        setStatus("Stopping…");
      }
    });
  });
};

// ---- run options: date limit + order ----

// remembered per popup in localStorage (no "storage" permission needed);
// any storage failure just falls back to the defaults
function loadOption(key, fallback) {
  try {
    var v = localStorage.getItem("erasure." + key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function saveOption(key, value) {
  try {
    localStorage.setItem("erasure." + key, value);
  } catch (e) {
    // not remembered — harmless
  }
}

function todayIso() {
  var d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// delete-button captions follow the date limit
var deleteButtons = [
  [deleteCommentHistory, "Comments"],
  [deleteLiveChats, "Live Chats"],
  [deleteCommunityPosts, "Community Posts"],
];

function updateDeleteLabels() {
  var limit = cutoffDate.value
    ? " up to " + new Date(cutoffDate.value + "T00:00").toLocaleDateString()
    : "";
  deleteButtons.forEach(function (b) {
    b[0].firstElementChild.textContent =
      "Click to delete " + (limit ? "" : "all ") + b[1] + limit;
  });
}

cutoffDate.max = todayIso();
cutoffDate.value = loadOption("cutoffDate", "");
oldestFirst.checked = loadOption("oldestFirst", "true") === "true";
updateDeleteLabels();

cutoffDate.onchange = function () {
  saveOption("cutoffDate", cutoffDate.value);
  updateDeleteLabels();
};
clearCutoff.onclick = function () {
  cutoffDate.value = "";
  cutoffDate.onchange();
};
oldestFirst.onchange = function () {
  saveOption("oldestFirst", String(oldestFirst.checked));
};

function runOptions() {
  return {
    cutoffDate: cutoffDate.value || null, // "YYYY-MM-DD", inclusive
    oldestFirst: oldestFirst.checked,
  };
}

// ---- manager page ----

// opens as a window floating over the browser, so the My Activity tab it
// drives stays visible (and keeps rendering) behind it
openManager.onclick = function () {
  var url = chrome.runtime.getURL("manager.html");
  var open = chrome.extension.getViews({ type: "tab" }).find(function (v) {
    return v.location.href === url && v.erasureFocus;
  });
  if (open) {
    open.erasureFocus();
    window.close();
    return;
  }
  var width = Math.min(1100, screen.availWidth - 160);
  var height = Math.min(900, screen.availHeight - 80);
  chrome.windows.create(
    {
      url: url,
      type: "popup",
      width: width,
      height: height,
      left: Math.round(screen.availLeft + (screen.availWidth - width) / 2),
      top: Math.round(screen.availTop + (screen.availHeight - height) / 2),
    },
    function () {
      window.close();
    }
  );
};

// ---- navigate / delete buttons ----

// comment history
deleteCommentHistory.onclick = function (element) {
  executeScriptInTab(chrome.tabs, chrome.scripting);
};
commentHistory.onclick = function (element) {
  openTab(chrome.tabs, "https://www.youtube.com/feed/history/comment_history");
};

// live chat history
deleteLiveChats.onclick = function (element) {
  executeScriptInTab(chrome.tabs, chrome.scripting);
};

liveChats.onclick = function (element) {
  openTab(chrome.tabs, "https://www.youtube.com/feed/history/live_chat_history");
};

// community posts
deleteCommunityPosts.onclick = function (element) {
  executeScriptInTab(chrome.tabs, chrome.scripting);
};

communityPosts.onclick = function (element) {
  openTab(chrome.tabs, "https://myactivity.google.com/page?utm_source=my-activity&hl=en&page=youtube_posts_activity");
};

// reusable functions
function openTab(tabs, page) {
  targetPage = page;
  tabs.create({
    active: true,
    url: targetPage,
  });
}

function executeScriptInTab(tabs, scripting) {
  tabs.query({ active: true, currentWindow: true }, function (tabList) {
    var tab = tabList && tabList[0];
    if (!tab) {
      return;
    }
    // activeTab (granted by opening the popup) exposes tab.url here — no
    // "tabs" permission needed. An unreadable url is treated as wrong-page.
    if (!isHistoryPage(tab.url)) {
      setStatus(
        "This tab isn't a YouTube history page — click a navigate button first.",
        true
      );
      return;
    }
    setStatus("Starting…");
    var target = { tabId: tab.id, allFrames: true };
    // hand the options to the script first: both injections run in the
    // same isolated world, so the script reads them from window
    scripting
      .executeScript({
        target: target,
        func: function (opts) {
          window.__erasureOptions = opts;
        },
        args: [runOptions()],
      })
      .then(function () {
        return scripting.executeScript({
          target: target,
          files: [deletionScript],
        });
      })
      .catch(function (e) {
        setStatus("Could not start on this page: " + e.message, true);
      });
  });
}
