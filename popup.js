const recentPanel = document.getElementById("recent");
const collectionsPanel = document.getElementById("collections");

const archiveBtn = document.getElementById("archiveNow");
const providerSelect = document.getElementById("provider");
const newTabToggle = document.getElementById("newTab");

const tabs = document.querySelectorAll(".tab");

const searchInput = document.getElementById("search");
let cachedRecent = [];

tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  };
});

async function load() {
  const data = await chrome.storage.local.get(["recent", "collections", "settings"]);
  renderRecent(data.recent || []);
  renderCollections(data.collections || {});
}

function renderRecent(items) {
  cachedRecent = items;
  applySearch();
}


function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  recentPanel.innerHTML = "";

  cachedRecent
    .filter(item =>
      item.title?.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    )
    .slice(0, 10)
    .forEach(item => {
const div = document.createElement("div");
div.className = "card clickable";

div.innerHTML = `
<div class="row">
  <span>${item.title || item.url}</span>
  <button class="add">＋</button>
</div>

  <small>${new Date(item.time).toLocaleString()}</small>
`;

div.onclick = async () => {
  const clean = item.url.replace(/^https?:\/\//, "");
  const provider = providerSelect.value;
  const target = `https://${provider}/${clean}`;

  if (newTabToggle.checked) {
    chrome.tabs.create({ url: target });
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.update(tab.id, { url: target });
  }
};

div.querySelector(".add").onclick = async (e) => {
  e.stopPropagation();

  const name = prompt("Add to collection:");
  if (!name) return;

  const data = await chrome.storage.local.get(["collections"]);
  const collections = data.collections || {};

  collections[name] = collections[name] || [];
  collections[name].push(item);

  await chrome.storage.local.set({ collections });
  renderCollections(collections);
};


recentPanel.appendChild(div);

    });
}

if (searchInput){
    searchInput.addEventListener("input", applySearch);
}



function renderCollections(collections) {
  collectionsPanel.innerHTML = "";
  Object.keys(collections).forEach(name => {
    const div = document.createElement("div");
    div.className = "card";
    div.textContent = `${name} (${collections[name].length})`;
    collectionsPanel.appendChild(div);
  });
}

archiveBtn.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.url.includes("archive.")) return;

  const clean = tab.url.replace(/^https?:\/\//, "");
  const provider = providerSelect.value;
  const target = `https://${provider}/${clean}`;

  const data = await chrome.storage.local.get(["recent"]);
  const recent = data.recent || [];
  recent.unshift({
    url: tab.url,
    title: tab.title,
    time: Date.now()
  });

  await chrome.storage.local.set({ recent });
  console.log("Saved recent:", recent);

  if (newTabToggle.checked) {
    chrome.tabs.create({ url: target });
  } else {
    chrome.tabs.update(tab.id, { url: target });
  }
};
;

load();
