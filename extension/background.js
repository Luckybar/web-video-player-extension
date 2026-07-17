/*
 * Injects the one-hand video controller into the active tab when the user
 * taps the toolbar icon. Re-tapping toggles it (the controller detects an
 * existing instance and toggles its own visibility).
 */
chrome.action.onClicked.addListener(function (tab) {
  if (!tab || !tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: ['controller.js']
  }).catch(function (err) {
    // Common on restricted pages (chrome://, web store, PDF viewer, etc.)
    console.warn('One-Hand Video Controller: cannot inject here —', err && err.message);
  });
});
