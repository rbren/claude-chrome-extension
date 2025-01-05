console.log('🟢 Content script loaded');

// Create a visible log element
const logDiv = document.createElement('div');
logDiv.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
  z-index: 999999;
  max-width: 500px;
  max-height: 300px;
  overflow: auto;
`;
document.body.appendChild(logDiv);

function visualLog(message, type = 'info') {
  const color = type === 'error' ? '#ff4444' : '#44ff44';
  console.log(message);
  const entry = document.createElement('div');
  entry.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
  entry.style.color = color;
  entry.textContent = message;
  logDiv.appendChild(entry);
  
  // Keep only last 10 messages
  while (logDiv.children.length > 10) {
    logDiv.removeChild(logDiv.firstChild);
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  visualLog('📥 Received message: ' + request.action);
  
  if (request.action === 'executeCode') {
    visualLog('⚡ Executing code: ' + request.code);
    try {
      const result = eval(request.code);
      visualLog('✅ Code execution result: ' + JSON.stringify(result));
      sendResponse({ success: true, result });
    } catch (error) {
      const errorMsg = '❌ Execution error: ' + error.toString();
      visualLog(errorMsg, 'error');
      sendResponse({ success: false, error: error.toString() });
    }
  }
  return true;
});