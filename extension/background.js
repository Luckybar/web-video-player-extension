/*
 * Injects the one-hand two-zone video controller into the active tab when the
 * user taps the toolbar icon. Re-tapping toggles the overlay's visibility
 * (the controller detects an existing instance and toggles itself).
 */
chrome.action.onClicked.addListener(function (tab) {
  if (!tab || !tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: ['controller.js']
  }).catch(function (err) {
    console.warn('One-Hand Video Controller: cannot inject here —', err && err.message);
  });
});
