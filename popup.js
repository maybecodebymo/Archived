// =====================
// DOM REFERENCES
// =====================
const recentPanel = document.getElementById("recent");
const collectionsPanel = document.getElementById("collections");
const archiveBtn = document.getElementById("archiveNow");
const providerSelect = document.getElementById("provider");
const providerBtn = document.getElementById("providerBtn");
const providerLabel = document.getElementById("providerLabel");
const newTabToggle = document.getElementById("newTabToggle");
const tabs = document.querySelectorAll(".tab");
const tabsWrap = document.querySelector(".tabs");
const tabIndicator = document.querySelector(".tab-indicator");
const searchInput = document.getElementById("search");
const collectionHero = document.getElementById("collectionHero");
const collectionHeroTitle = document.getElementById("collectionHeroTitle");
const collectionBackBtn = document.getElementById("collectionBack");
const collectionHeroMenu = document.getElementById("collectionHeroMenu");
const historyPanel = document.getElementById("history");
const themeToggle = document.getElementById("themeToggle");
const historyMenuBtn = document.getElementById("historyMenu");

// Modal
const collectionModal = document.getElementById("collectionModal");
const collectionSelect = document.getElementById("collectionSelect");
const collectionInput = document.getElementById("collectionInput");
const saveToCollectionBtn = document.getElementById("saveToCollection");
const cancelCollectionBtn = document.getElementById("cancelCollection");
const modalTitle = document.getElementById("modalTitle");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancelBtn = document.getElementById("confirmCancel");
const confirmActionBtn = document.getElementById("confirmAction");

// =====================
// STATE
// =====================
let cachedRecent = [];
let cachedHistory = [];
let pendingItem = null;
let modalMode = "add"; // add | rename
let renameContext = null; // { type: "article" | "collection", name, source, collectionName }
let activeCollectionName = null;
let collectionTransitionTimer = null;
let confirmResolve = null;
let openInNewTab = false;
const archiveProviders = ["archive.is", "archive.today", "archive.ph"];

// =====================
// TABS
// =====================
function setTabState(tabName) {
  document.body.dataset.tab = tabName;
  if (tabName !== "collections") {
    setCollectionDetailState(false);
  }
}

function setCollectionDetailState(isDetail) {
  document.body.dataset.collection = isDetail ? "detail" : "list";
  if (collectionHero) {
    collectionHero.setAttribute("aria-hidden", isDetail ? "false" : "true");
    if (isDetail) {
      collectionHero.classList.remove("is-exiting");
    }
  }
  if (!isDetail) {
    clearHeroFly();
    activeCollectionName = null;
    if (collectionHeroTitle) {
      collectionHeroTitle.textContent = "";
    }
    if (collectionHero) {
      collectionHero.classList.remove("is-visible", "is-exiting");
    }
  }
}

let heroFly = null;

function clearHeroFly() {
  if (heroFly) {
    heroFly.remove();
    heroFly = null;
  }
}

function beginCollectionExit() {
  if (!collectionHero) return 0;
  clearHeroFly();
  collectionHero.classList.remove("is-visible");
  collectionHero.classList.add("is-exiting");
  collectionHero.setAttribute("aria-hidden", "true");
  return 220;
}

function animateCollectionHero(name, sourceRectOrEl) {
  if (!collectionHero || !collectionHeroTitle) return;
  collectionHeroTitle.textContent = name;
  collectionHero.setAttribute("aria-hidden", "false");
  clearHeroFly();

  let sourceRect = null;
  if (sourceRectOrEl) {
    sourceRect =
      typeof sourceRectOrEl.getBoundingClientRect === "function"
        ? sourceRectOrEl.getBoundingClientRect()
        : sourceRectOrEl;
  }

  if (!sourceRect) {
    collectionHero.classList.add("is-visible");
    return;
  }

  collectionHero.classList.remove("is-visible");

  requestAnimationFrame(() => {
    const targetRect = collectionHeroTitle.getBoundingClientRect();

    if (!sourceRect.width || !targetRect.width) {
      collectionHero.classList.add("is-visible");
      return;
    }

    const fly = document.createElement("div");
    fly.className = "collection-fly";
    fly.textContent = name;
    document.body.appendChild(fly);
    heroFly = fly;

    fly.style.left = `${sourceRect.left}px`;
    fly.style.top = `${sourceRect.top}px`;
    fly.style.width = `${sourceRect.width}px`;
    fly.style.transform = "translate(0, 0) scale(1)";

    const dx = targetRect.left - sourceRect.left;
    const dy = targetRect.top - sourceRect.top;
    const scale = targetRect.width / sourceRect.width;

    requestAnimationFrame(() => {
      if (!heroFly) return;
      heroFly.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      heroFly.style.opacity = "0";
    });

    const revealTimer = setTimeout(() => {
      collectionHero.classList.add("is-visible");
    }, 180);

    const finish = () => {
      clearTimeout(revealTimer);
      clearHeroFly();
      collectionHero.classList.add("is-visible");
    };

    fly.addEventListener("transitionend", finish, { once: true });
    setTimeout(() => {
      finish();
    }, 380);
  });
}

function updateTabIndicator() {
  if (!tabIndicator || !tabsWrap) return;
  const activeTab = document.querySelector(".tab.active");
  if (!activeTab) return;
  const tabsRect = tabsWrap.getBoundingClientRect();
  const activeRect = activeTab.getBoundingClientRect();
  const textWidth = activeTab.scrollWidth;
  const offset = activeRect.left - tabsRect.left + (activeRect.width - textWidth) / 2;
  tabIndicator.style.width = `${textWidth}px`;
  tabIndicator.style.transform = `translateX(${offset}px)`;
}

window.addEventListener("resize", () => {
  updateTabIndicator();
  if (activeMenu && activeMenu.__anchor) {
    positionMenu(activeMenu, activeMenu.__anchor);
  }
});

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.classList.toggle("is-dark", theme === "dark");
    themeToggle.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
  }
}

function buildArchiveUrl(rawUrl) {
  if (!rawUrl) return "";
  const provider = providerSelect?.value || archiveProviders[0];
  const clean = rawUrl.replace(/^https?:\/\//i, "");
  return `https://${provider}/${clean}`;
}

function isArchiveUrl(rawUrl) {
  if (!rawUrl) return false;
  const normalized = rawUrl.toLowerCase();
  return archiveProviders.some(domain =>
    normalized.startsWith(`https://${domain}`) ||
    normalized.startsWith(`http://${domain}`)
  );
}

async function openArchivedUrl(rawUrl, tabId = null) {
  const target = buildArchiveUrl(rawUrl);
  if (!target) return;
  if (openInNewTab) {
    await chrome.tabs.create({ url: target });
  } else if (typeof tabId === "number") {
    await chrome.tabs.update(tabId, { url: target });
  } else {
    await chrome.tabs.update({ url: target });
  }
}

async function initTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  if (theme) {
    applyTheme(theme);
    return;
  }
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function applyOpenInNewTab(enabled) {
  openInNewTab = Boolean(enabled);
  if (newTabToggle) {
    newTabToggle.classList.toggle("is-on", openInNewTab);
    newTabToggle.setAttribute("aria-checked", openInNewTab ? "true" : "false");
  }
}

async function initOpenInNewTab() {
  const { openInNewTab: stored } = await chrome.storage.local.get("openInNewTab");
  const enabled = typeof stored === "boolean" ? stored : false;
  applyOpenInNewTab(enabled);
  if (typeof stored !== "boolean") {
    await chrome.storage.local.set({ openInNewTab: enabled });
  }
}

function normalizeHistoryLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function initHistoryLimit() {
  const { historyLimit } = await chrome.storage.local.get("historyLimit");
  const limit =
    Number.isFinite(historyLimit) && historyLimit >= 0 ? historyLimit : 500;
  if (!Number.isFinite(historyLimit)) {
    await chrome.storage.local.set({ historyLimit: limit });
  }
  return limit;
}

tabs.forEach(tab => {
  tab.onclick = () => {
    closeActiveMenu();
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
    setTabState(tab.dataset.tab);
    updateTabIndicator();
    applySearch();
  };
});

if (collectionBackBtn) {
  collectionBackBtn.onclick = async () => {
    if (!activeCollectionName) return;
    closeActiveMenu();
    const exitDuration = beginCollectionExit();
    if (collectionTransitionTimer) {
      clearTimeout(collectionTransitionTimer);
    }
    collectionsPanel.classList.add("transitioning");
    const { collections } = await chrome.storage.local.get("collections");
    collectionTransitionTimer = setTimeout(() => {
      renderCollections(collections || {});
      collectionTransitionTimer = null;
    }, exitDuration || 200);
  };
}

if (collectionHeroMenu) {
  collectionHeroMenu.onclick = e => {
    e.stopPropagation();
    if (!activeCollectionName) return;
    showCollectionMenu(e.currentTarget, activeCollectionName);
  };
}

if (providerBtn) {
  providerBtn.onclick = e => {
    e.stopPropagation();
    showProviderMenu(providerBtn);
  };
}

if (providerSelect) {
  providerSelect.onchange = () => {
    syncProviderLabel();
  };
}

if (historyMenuBtn) {
  historyMenuBtn.onclick = e => {
    e.stopPropagation();
    showHistoryMenu(historyMenuBtn);
  };
}

if (themeToggle) {
  themeToggle.onclick = async () => {
    const current = document.body.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    await chrome.storage.local.set({ theme: next });
  };
}

if (newTabToggle) {
  newTabToggle.onclick = async () => {
    const next = !openInNewTab;
    applyOpenInNewTab(next);
    await chrome.storage.local.set({ openInNewTab: next });
  };
}


// =====================
// MODAL UI
// =====================
function updateModalUI() {
  if (modalMode === "rename") {
    modalTitle.textContent = "Rename";
    collectionSelect.classList.add("hidden");
    collectionInput.style.display = "block";
  } else {
    modalTitle.textContent = "Add to collection";
    collectionSelect.classList.remove("hidden");
    collectionSelect.value = "";
    collectionInput.value = "";
    collectionInput.placeholder = "New collection name";
    collectionInput.style.display = "block";
  }
}

function closeConfirmModal(result) {
  if (confirmModal) {
    confirmModal.classList.add("hidden");
  }
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

function showConfirmModal({ title, message, confirmLabel }) {
  if (!confirmModal || !confirmTitle || !confirmMessage || !confirmActionBtn) {
    return Promise.resolve(false);
  }
  if (confirmResolve) {
    confirmResolve(false);
    confirmResolve = null;
  }

  confirmTitle.textContent = title || "Confirm";
  confirmMessage.textContent = message || "";
  confirmActionBtn.textContent = confirmLabel || "Confirm";
  confirmModal.classList.remove("hidden");

  return new Promise(resolve => {
    confirmResolve = resolve;
  });
}

if (confirmCancelBtn) {
  confirmCancelBtn.onclick = () => closeConfirmModal(false);
}

if (confirmActionBtn) {
  confirmActionBtn.onclick = () => closeConfirmModal(true);
}

collectionSelect.onchange = () => {
  if (modalMode !== "add") return;
  collectionInput.style.display =
    collectionSelect.value === "" ? "block" : "none";
};

// =====================
// SEARCH
// =====================
function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  const active = document.querySelector(".tab.active")?.dataset.tab;

  if (active === "recent") {
    renderRecentFiltered(q);
  } else if (active === "collections") {
    renderCollectionsFiltered(q);
  } else if (active === "history") {
    renderHistoryFiltered(q);
  }
}

searchInput.addEventListener("input", applySearch);

// =====================
// RECENT
// =====================
function renderRecent(items) {
  cachedRecent = items;
  renderRecentFiltered("");
}

function renderRecentFiltered(q) {
  recentPanel.replaceChildren();
  let index = 0;

  cachedRecent
    .filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.url.toLowerCase().includes(q)
    )
    .slice(0, 10)
    .forEach(item => {
      const card = buildArticleCard(item, "recent");
      if (q) {
        card.classList.add("is-search-result");
        card.style.setProperty("--delay", `${index * 40}ms`);
        index += 1;
      }
      recentPanel.appendChild(card);
    });
}

// =====================
// HISTORY
// =====================
function renderHistory(items) {
  cachedHistory = items;
  renderHistoryFiltered("");
}

function renderHistoryFiltered(q) {
  if (!historyPanel) return;
  historyPanel.replaceChildren();

  const filtered = cachedHistory
    .filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.url.toLowerCase().includes(q)
    );

  if (!filtered.length) {
    historyPanel.replaceChildren(
      createMutedCard(q ? "No results" : "No history yet")
    );
    return;
  }

  let index = 0;
  filtered.forEach(item => {
    const card = buildArticleCard(item, "history");
    if (q) {
      card.classList.add("is-search-result");
      card.style.setProperty("--delay", `${index * 40}ms`);
      index += 1;
    }
    historyPanel.appendChild(card);
  });
}

// =====================
// COLLECTIONS
// =====================
function renderCollections(collections) {
  setCollectionDetailState(false);
  if (collectionTransitionTimer) {
    clearTimeout(collectionTransitionTimer);
    collectionTransitionTimer = null;
  }
  collectionsPanel.classList.remove("transitioning");
  collectionsPanel.replaceChildren();

  const names = Object.keys(collections);
  if (!names.length) {
    collectionsPanel.replaceChildren(createMutedCard("No collections yet"));
    return;
  }

  names.forEach(name => {
    const div = document.createElement("div");
    div.className = "card clickable";
    const title = document.createElement("strong");
    title.textContent = name;
    const meta = document.createElement("small");
    meta.textContent = `${collections[name].length} items`;
    div.append(title, meta);
    div.title = "Click to open collection";

    div.onclick = () => renderCollectionDetail(name, collections[name], div);
    collectionsPanel.appendChild(div);
  });
}

function renderCollectionDetail(name, items, sourceEl = null) {
  const sourceRect = sourceEl
    ? (sourceEl.querySelector("strong") || sourceEl).getBoundingClientRect()
    : null;
  activeCollectionName = name;
  setCollectionDetailState(true);
  animateCollectionHero(name, sourceRect);
  if (collectionTransitionTimer) {
    clearTimeout(collectionTransitionTimer);
  }
  collectionsPanel.classList.add("transitioning");

  collectionTransitionTimer = setTimeout(() => {
    collectionsPanel.replaceChildren();
    items.forEach(item => {
      collectionsPanel.appendChild(buildArticleCard(item, "collection", name, false));
    });
    collectionsPanel.classList.remove("transitioning");
    collectionTransitionTimer = null;
  }, 160);
}

function renderCollectionsFiltered(q) {
  chrome.storage.local.get("collections", ({ collections = {} }) => {
    if (collectionTransitionTimer) {
      clearTimeout(collectionTransitionTimer);
      collectionTransitionTimer = null;
    }
    collectionsPanel.classList.remove("transitioning");
    collectionsPanel.replaceChildren();
    setCollectionDetailState(false);

    if (!q) {
      renderCollections(collections);
      return;
    }

    let index = 0;
    Object.entries(collections).forEach(([name, items]) => {
      items
        .filter(i =>
          i.title?.toLowerCase().includes(q) ||
          i.url.toLowerCase().includes(q)
        )
        .forEach(item => {
          const card = buildArticleCard(item, "collection", name, true);
          card.classList.add("is-search-result");
          card.style.setProperty("--delay", `${index * 40}ms`);
          index += 1;
          collectionsPanel.appendChild(card);
        });
    });
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

function createIconGlobe() {
  const svg = createSvgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    createSvgEl("circle", {
      cx: "12",
      cy: "12",
      r: "8",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6"
    }),
    createSvgEl("path", {
      d: "M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.2",
      "stroke-linecap": "round"
    })
  );
  return svg;
}

function createIconPencil() {
  const svg = createSvgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    createSvgEl("path", {
      d: "M4 20h4l10-10-4-4L4 16v4Z",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6"
    }),
    createSvgEl("path", {
      d: "M14 6l4 4",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round"
    })
  );
  return svg;
}

function createIconFolder() {
  const svg = createSvgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    createSvgEl("path", {
      d: "M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linejoin": "round"
    })
  );
  return svg;
}

function createIconTrash() {
  const svg = createSvgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    createSvgEl("path", {
      d: "M5 7h14",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round"
    }),
    createSvgEl("path", {
      d: "M9 7V5h6v2",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round"
    }),
    createSvgEl("rect", {
      x: "7",
      y: "7",
      width: "10",
      height: "12",
      rx: "1.5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6"
    }),
    createSvgEl("path", {
      d: "M10 11v5M14 11v5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round"
    })
  );
  return svg;
}

function createIconRemove() {
  const svg = createSvgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    createSvgEl("path", {
      d: "M7 12h10",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round"
    })
  );
  return svg;
}

function createIconClock() {
  const svg = createSvgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    createSvgEl("circle", {
      cx: "12",
      cy: "12",
      r: "8",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6"
    }),
    createSvgEl("path", {
      d: "M12 7v5l3 2",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round"
    })
  );
  return svg;
}

function createMenuSection(text) {
  const section = document.createElement("div");
  section.className = "menu-section";
  section.textContent = text;
  return section;
}

function createMenuItem({ label, icon, className = "", dataset = {} }) {
  const item = document.createElement("div");
  item.className = `menu-item${className ? ` ${className}` : ""}`;
  Object.entries(dataset).forEach(([key, value]) => {
    item.dataset[key] = value;
  });
  if (icon) {
    const iconWrap = document.createElement("span");
    iconWrap.className = "menu-icon";
    iconWrap.appendChild(icon);
    item.appendChild(iconWrap);
  }
  const labelSpan = document.createElement("span");
  labelSpan.className = "menu-label";
  labelSpan.textContent = label;
  item.appendChild(labelSpan);
  return item;
}

function createMutedCard(text) {
  const div = document.createElement("div");
  div.className = "card muted";
  div.textContent = text;
  return div;
}
// =====================
// ARTICLE CARD + MENU
// =====================
function buildArticleCard(item, context, collectionName = null, showCollectionLabel = false) {
  const div = document.createElement("div");
  div.className = "card clickable";
  const row = document.createElement("div");
  row.className = "row";

  const title = document.createElement("span");
  title.title = item.url;
  title.textContent = item.title || item.url;

  const menuBtn = document.createElement("button");
  menuBtn.className = "menu";
  menuBtn.type = "button";
  menuBtn.setAttribute("aria-label", "Item menu");
  menuBtn.textContent = "\u22ee";

  row.append(title, menuBtn);
  div.appendChild(row);

  if (showCollectionLabel && collectionName) {
    const collectionMeta = document.createElement("small");
    collectionMeta.className = "collection-meta";
    collectionMeta.textContent = `Collection \u00b7 ${collectionName}`;
    div.appendChild(collectionMeta);
  }

  const time = document.createElement("small");
  time.textContent = new Date(item.time).toLocaleString();
  div.appendChild(time);

  div.onclick = () => openItem(item);

  menuBtn.onclick = e => {
    e.stopPropagation();
    showMenu(menuBtn, item, context, collectionName);
  };

  return div;
}

async function openItem(item) {
  await openArchivedUrl(item.url);
}

// =====================
// DROPDOWN MENU
// =====================
let activeMenu = null;

function closeActiveMenu() {
  if (activeMenu) {
    if (activeMenu.__type === "provider" && providerBtn) {
      providerBtn.setAttribute("aria-expanded", "false");
    }
    activeMenu.remove();
    activeMenu = null;
  }
}

// Close menu on any scroll within the popup or when focus leaves.
document.addEventListener("scroll", closeActiveMenu, true);
window.addEventListener("blur", closeActiveMenu);

function positionMenu(menu, anchor) {
  const r = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const pad = 8;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  let left = r.left;
  let top = r.bottom;

  if (left + menuRect.width + pad > viewportWidth) {
    left = viewportWidth - menuRect.width - pad;
  }
  if (left < pad) left = pad;

  if (top + menuRect.height + pad > viewportHeight) {
    top = r.top - menuRect.height;
  }
  if (top < pad) top = pad;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function syncProviderLabel() {
  if (!providerSelect || !providerLabel) return;
  const selected =
    providerSelect.options && providerSelect.selectedIndex >= 0
      ? providerSelect.options[providerSelect.selectedIndex]
      : null;
  providerLabel.textContent = selected ? selected.textContent : providerSelect.value;
}

function showProviderMenu(anchor) {
  if (!providerSelect) return;
  if (activeMenu && activeMenu.__anchor === anchor) {
    closeActiveMenu();
    return;
  }

  closeActiveMenu();

  const options = Array.from(providerSelect.options || []);
  const menu = document.createElement("div");
  menu.className = "dropdown";
  menu.__anchor = anchor;
  menu.__type = "provider";

  options.forEach(option => {
    const isActive = option.value === providerSelect.value;
    const item = createMenuItem({
      label: option.textContent,
      icon: createIconGlobe(),
      className: isActive ? "is-active" : "",
      dataset: { value: option.value }
    });
    menu.appendChild(item);
  });

  menu.onclick = e => {
    const itemEl = e.target.closest("[data-value]");
    if (!itemEl) return;
    providerSelect.value = itemEl.dataset.value;
    syncProviderLabel();
    closeActiveMenu();
  };

  document.body.appendChild(menu);
  activeMenu = menu;
  menu.querySelectorAll(".menu-item").forEach((itemEl, index) => {
    itemEl.style.setProperty("--delay", `${index * 40}ms`);
  });
  positionMenu(menu, anchor);
  requestAnimationFrame(() => {
    menu.classList.add("is-open");
  });
  if (providerBtn) {
    providerBtn.setAttribute("aria-expanded", "true");
  }

  setTimeout(() => {
    const handleOutside = e => {
      if (activeMenu && !activeMenu.contains(e.target) && e.target !== anchor) {
        closeActiveMenu();
      }
    };
    document.addEventListener("click", handleOutside, { once: true });
  }, 0);
}

function showMenu(anchor, item, context, collectionName) {
  if (activeMenu && activeMenu.__anchor === anchor) {
    closeActiveMenu();
    return;
  }

  closeActiveMenu();

  const menu = document.createElement("div");
  menu.className = "dropdown";
  menu.__anchor = anchor;

  menu.appendChild(
    createMenuItem({
      label: "Rename",
      icon: createIconPencil(),
      dataset: { action: "rename" }
    })
  );

  if (context === "recent" || context === "history") {
    menu.appendChild(
      createMenuItem({
        label: "Add to collection",
        icon: createIconFolder(),
        dataset: { action: "add" }
      })
    );
  }

  if (context === "collection") {
    menu.appendChild(
      createMenuItem({
        label: "Remove",
        icon: createIconRemove(),
        dataset: { action: "delete" }
      })
    );
  }

  menu.appendChild(
    createMenuItem({
      label: "Delete",
      icon: createIconTrash(),
      className: "danger",
      dataset: { action: "purge" }
    })
  );

  menu.onclick = async e => {
    const itemEl = e.target.closest("[data-action]");
    if (!itemEl) return;
    const action = itemEl.dataset.action;

    if (action === "rename") {
      modalMode = "rename";
      pendingItem = item;
      renameContext = { type: "article", collectionName, source: context };
      collectionInput.value = item.title || "";
      updateModalUI();
      collectionModal.classList.remove("hidden");
    }

    if (action === "add") {
      modalMode = "add";
      pendingItem = item;

      const { collections = {} } = await chrome.storage.local.get("collections");
      collectionSelect.replaceChildren();
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = `New collection\u2026`;
      collectionSelect.appendChild(defaultOption);
      Object.keys(collections).forEach(name => {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = name;
        collectionSelect.appendChild(o);
      });

      updateModalUI();
      collectionModal.classList.remove("hidden");
    }

    if (action === "delete") {
      const { collections } = await chrome.storage.local.get("collections");
      collections[collectionName] =
        collections[collectionName].filter(i => i.url !== item.url);
      await chrome.storage.local.set({ collections });
      renderCollectionDetail(collectionName, collections[collectionName]);
    }

    if (action === "purge") {
      await deleteItemEverywhere(item);
    }

    menu.remove();
    activeMenu = null;
  };

  document.body.appendChild(menu);
  activeMenu = menu;
  menu.querySelectorAll(".menu-item").forEach((itemEl, index) => {
    itemEl.style.setProperty("--delay", `${index * 40}ms`);
  });
  positionMenu(menu, anchor);
  requestAnimationFrame(() => {
    menu.classList.add("is-open");
  });

  // Close on any outside click after the menu is shown.
  setTimeout(() => {
    const handleOutside = e => {
      if (activeMenu && !activeMenu.contains(e.target) && e.target !== anchor) {
        closeActiveMenu();
      }
    };
    document.addEventListener("click", handleOutside, { once: true });
  }, 0);
}

function showCollectionMenu(anchor, name) {
  if (activeMenu && activeMenu.__anchor === anchor) {
    closeActiveMenu();
    return;
  }

  closeActiveMenu();

  const menu = document.createElement("div");
  menu.className = "dropdown";
  menu.__anchor = anchor;

  menu.appendChild(
    createMenuItem({
      label: "Rename",
      icon: createIconPencil(),
      dataset: { action: "rename" }
    })
  );

  menu.appendChild(
    createMenuItem({
      label: "Delete",
      icon: createIconTrash(),
      dataset: { action: "delete" }
    })
  );

  menu.onclick = async e => {
    const itemEl = e.target.closest("[data-action]");
    if (!itemEl) return;
    const action = itemEl.dataset.action;

    if (action === "rename") {
      modalMode = "rename";
      renameContext = { type: "collection", name };
      collectionInput.value = name;
      updateModalUI();
      collectionModal.classList.remove("hidden");
    }

    if (action === "delete") {
      const { collections } = await chrome.storage.local.get("collections");
      delete collections[name];
      await chrome.storage.local.set({ collections });
      renderCollections(collections);
    }

    closeActiveMenu();
  };

  document.body.appendChild(menu);
  activeMenu = menu;
  menu.querySelectorAll(".menu-item").forEach((itemEl, index) => {
    itemEl.style.setProperty("--delay", `${index * 40}ms`);
  });
  positionMenu(menu, anchor);
  requestAnimationFrame(() => {
    menu.classList.add("is-open");
  });

  setTimeout(() => {
    const handleOutside = e => {
      if (activeMenu && !activeMenu.contains(e.target) && e.target !== anchor) {
        closeActiveMenu();
      }
    };
    document.addEventListener("click", handleOutside, { once: true });
  }, 0);
}

async function showHistoryMenu(anchor) {
  if (activeMenu && activeMenu.__anchor === anchor) {
    closeActiveMenu();
    return;
  }

  closeActiveMenu();

  const { historyLimit = 500 } = await chrome.storage.local.get("historyLimit");
  const limitValue =
    Number.isFinite(historyLimit) && historyLimit >= 0 ? historyLimit : 500;

  const menu = document.createElement("div");
  menu.className = "dropdown";
  menu.__anchor = anchor;
  menu.__type = "history";

  menu.appendChild(createMenuSection("History retention"));

  const retentionOptions = [
    { value: 100, label: "100 items" },
    { value: 500, label: "500 items" },
    { value: 1000, label: "1000 items" },
    { value: 0, label: "All items" }
  ];

  retentionOptions.forEach(option => {
    const item = createMenuItem({
      label: option.label,
      icon: createIconClock(),
      className: limitValue === option.value ? "is-active" : "",
      dataset: { retention: String(option.value) }
    });
    menu.appendChild(item);
  });

  menu.appendChild(
    createMenuItem({
      label: "Clear history",
      icon: createIconTrash(),
      className: "danger",
      dataset: { action: "clear" }
    })
  );

  menu.onclick = async e => {
    const retentionEl = e.target.closest("[data-retention]");
    if (retentionEl) {
      const limit = normalizeHistoryLimit(retentionEl.dataset.retention);
      await chrome.storage.local.set({ historyLimit: limit });
      const { history = [] } = await chrome.storage.local.get("history");
      const nextHistory = limit > 0 ? history.slice(0, limit) : history;
      if (nextHistory.length !== history.length) {
        await chrome.storage.local.set({ history: nextHistory });
      }
      cachedHistory = nextHistory;
      if (document.querySelector(".tab.active")?.dataset.tab === "history") {
        renderHistoryFiltered(searchInput.value.trim().toLowerCase());
      }
      closeActiveMenu();
      return;
    }

    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === "clear") {
      closeActiveMenu();
      const ok = await showConfirmModal({
        title: "Clear history",
        message: "Clear all history? This cannot be undone.",
        confirmLabel: "Clear history"
      });
      if (ok) {
        await chrome.storage.local.set({ history: [] });
        cachedHistory = [];
        renderHistoryFiltered(searchInput.value.trim().toLowerCase());
      }
      return;
    }
    closeActiveMenu();
  };

  document.body.appendChild(menu);
  activeMenu = menu;
  menu.querySelectorAll(".menu-item").forEach((itemEl, index) => {
    itemEl.style.setProperty("--delay", `${index * 40}ms`);
  });
  positionMenu(menu, anchor);
  requestAnimationFrame(() => {
    menu.classList.add("is-open");
  });

  setTimeout(() => {
    const handleOutside = e => {
      if (activeMenu && !activeMenu.contains(e.target) && e.target !== anchor) {
        closeActiveMenu();
      }
    };
    document.addEventListener("click", handleOutside, { once: true });
  }, 0);
}

async function deleteItemEverywhere(item) {
  const { recent = [], history = [], collections = {} } =
    await chrome.storage.local.get(["recent", "history", "collections"]);

  const nextRecent = recent.filter(i => i.url !== item.url);
  const nextHistory = history.filter(i => i.url !== item.url);
  let updatedCollections = false;

  Object.keys(collections).forEach(name => {
    if (!Array.isArray(collections[name])) return;
    const filtered = collections[name].filter(i => i.url !== item.url);
    if (filtered.length !== collections[name].length) {
      collections[name] = filtered;
      updatedCollections = true;
    }
  });

  await chrome.storage.local.set({
    recent: nextRecent,
    history: nextHistory,
    collections
  });

  cachedRecent = nextRecent;
  cachedHistory = nextHistory;

  const activeTab = document.querySelector(".tab.active")?.dataset.tab;
  if (activeTab === "recent") {
    renderRecentFiltered(searchInput.value.trim().toLowerCase());
  } else if (activeTab === "history") {
    renderHistoryFiltered(searchInput.value.trim().toLowerCase());
  } else if (activeTab === "collections") {
    if (activeCollectionName && collections[activeCollectionName]) {
      renderCollectionDetail(activeCollectionName, collections[activeCollectionName]);
    } else {
      renderCollections(collections);
    }
  }
}

// =====================
// MODAL SAVE / CANCEL
// =====================
saveToCollectionBtn.onclick = async () => {
  const { recent = [], history = [], collections = {} } = await chrome.storage.local.get([
    "recent",
    "history",
    "collections"
  ]);

  if (modalMode === "add") {
    const name = collectionSelect.value || collectionInput.value.trim();
    if (!name) return;

    collections[name] = collections[name] || [];
    collections[name].push(pendingItem);
    await chrome.storage.local.set({ collections });
  }

  if (modalMode === "rename") {
    const newName = collectionInput.value.trim();
    if (!newName) return;

    if (renameContext.type === "collection") {
      const oldName = renameContext.name;
      if (newName !== oldName) {
        if (collections[newName]) {
          alert("A collection with that name already exists.");
        } else if (collections[oldName]) {
          collections[newName] = collections[oldName];
          delete collections[oldName];
          await chrome.storage.local.set({ collections });
          renderCollections(collections);
        }
      }
    }

    if (renameContext.type === "article") {
      let updatedRecent = false;
      let updatedCollections = false;
      let updatedHistory = false;

      const recentIndex = recent.findIndex(i => i.url === pendingItem.url);
      if (recentIndex !== -1) {
        recent[recentIndex].title = newName;
        updatedRecent = true;
      }

      Object.keys(collections).forEach(name => {
        if (!Array.isArray(collections[name])) return;
        const itemIndex = collections[name].findIndex(
          i => i.url === pendingItem.url
        );
        if (itemIndex !== -1) {
          collections[name][itemIndex].title = newName;
          updatedCollections = true;
        }
      });

      if (updatedRecent) {
        await chrome.storage.local.set({ recent });
        cachedRecent = recent;
      }

      const historyIndex = (history || []).findIndex(i => i.url === pendingItem.url);
      if (historyIndex !== -1) {
        history[historyIndex].title = newName;
        updatedHistory = true;
      }

      if (updatedCollections) {
        await chrome.storage.local.set({ collections });
      }

      if (updatedHistory) {
        await chrome.storage.local.set({ history });
        cachedHistory = history;
      }

      const activeTab = document.querySelector(".tab.active")?.dataset.tab;
      if (activeTab === "recent") {
        renderRecentFiltered(searchInput.value.trim().toLowerCase());
      } else if (activeTab === "history") {
        renderHistoryFiltered(searchInput.value.trim().toLowerCase());
      } else {
        applySearch();
      }
    }
  }

  collectionModal.classList.add("hidden");
  applySearch();
};

cancelCollectionBtn.onclick = () => {
  collectionModal.classList.add("hidden");
};

// =====================
// ARCHIVE
// =====================
archiveBtn.onclick = async () => {
  archiveBtn.classList.add("is-archiving");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const { recent = [], history = [], historyLimit = 500 } =
      await chrome.storage.local.get(["recent", "history", "historyLimit"]);
    const entry = { url: tab.url, title: tab.title, time: Date.now() };
    recent.unshift(entry);
    const cappedRecent = recent.slice(0, 10);
    history.unshift(entry);
    const limit =
      Number.isFinite(historyLimit) && historyLimit > 0 ? historyLimit : 0;
    const nextHistory = limit > 0 ? history.slice(0, limit) : history;
    await chrome.storage.local.set({ recent: cappedRecent, history: nextHistory });
    renderRecent(cappedRecent);
    renderHistory(nextHistory);
    if (tab.url && !isArchiveUrl(tab.url)) {
      await openArchivedUrl(tab.url, tab.id);
    }
    archiveBtn.classList.add("is-success");
    setTimeout(() => archiveBtn.classList.remove("is-success"), 700);
  } finally {
    setTimeout(() => {
      archiveBtn.classList.remove("is-archiving");
    }, 520);
  }
};

// =====================
// INIT
// =====================
async function load() {
  let { recent = [], collections = {}, history = [] } =
    await chrome.storage.local.get(["recent", "collections", "history"]);
  if (recent.length > 10) {
    recent = recent.slice(0, 10);
    await chrome.storage.local.set({ recent });
  }
  const limit = await initHistoryLimit();
  if (limit > 0 && history.length > limit) {
    history = history.slice(0, limit);
    await chrome.storage.local.set({ history });
  }
  renderRecent(recent);
  renderCollections(collections);
  renderHistory(history);
  const activeTab = document.querySelector(".tab.active")?.dataset.tab || "recent";
  setTabState(activeTab);
  updateTabIndicator();
  syncProviderLabel();
  await initTheme();
  await initOpenInNewTab();
}

load();






