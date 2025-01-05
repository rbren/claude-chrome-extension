// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeCode') {
    try {
      eval(request.code);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.toString() });
    }
  }
  return true;
});