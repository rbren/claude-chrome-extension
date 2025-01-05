console.log('🟢 Content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🟢 Content script received message:', request);
  
  if (request.action === 'executeCode') {
    console.log('🟢 Executing code:', request.code);
    try {
      const result = eval(request.code);
      console.log('🟢 Code execution successful:', result);
      sendResponse({ success: true, result });
    } catch (error) {
      console.error('🔴 Code execution failed:', error);
      sendResponse({ success: false, error: error.toString() });
    }
  }
  return true;
});