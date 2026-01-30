chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "archive-current-tab") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  if (tab.url.startsWith("https://archive.is")) return;

  const cleanedUrl = tab.url.replace(/^https?:\/\//, "");
  const archiveUrl = `https://archive.is/${cleanedUrl}`;

  chrome.tabs.update(tab.id, { url: archiveUrl });
});
