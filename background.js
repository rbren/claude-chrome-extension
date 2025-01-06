// Keep track of the popup window
let popupWindowId = null;

// Listen for clicks on the extension icon
chrome.browserAction.onClicked.addListener(() => {
  if (popupWindowId !== null) {
    // If we have a popup window, focus it
    chrome.windows.update(popupWindowId, { focused: true });
  } else {
    // Create a new popup window
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 800,
      height: 800
    }, (window) => {
      popupWindowId = window.id;
    });
  }
});

// Listen for window removal to reset the popup window ID
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});