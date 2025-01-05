console.log('🟢 Content script loaded - ' + new Date().toISOString());

// Wait for DOM to be ready
function initializeLogging() {
    console.log('Initializing logging overlay');
    
    // Create a visible log element
    const logDiv = document.createElement('div');
    logDiv.id = 'claude-extension-log';
    logDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 600px;
        height: 400px;
        background: #000000;
        color: #00ff00;
        padding: 20px;
        border-radius: 10px;
        font-family: monospace;
        font-size: 14px;
        line-height: 1.5;
        z-index: 2147483647;
        overflow: auto;
        border: 2px solid #00ff00;
        box-shadow: 0 0 10px rgba(0,255,0,0.5);
    `;
    document.body.appendChild(logDiv);
    console.log('Logging overlay created');

    // Add initial message
    const initialMessage = document.createElement('div');
    initialMessage.textContent = '🟢 Claude Extension Log - ' + new Date().toISOString();
    initialMessage.style.borderBottom = '1px solid #00ff00';
    initialMessage.style.marginBottom = '10px';
    initialMessage.style.paddingBottom = '10px';
    logDiv.appendChild(initialMessage);
    console.log('Initial message added to overlay');

    return logDiv;
}

let logDiv;

// Try to initialize immediately
logDiv = initializeLogging();

// If that fails, try again when the DOM is ready
if (!logDiv) {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded - trying to initialize logging again');
        logDiv = initializeLogging();
    });
}

// And try one more time after a short delay
setTimeout(() => {
    if (!logDiv || !document.getElementById('claude-extension-log')) {
        console.log('Delayed initialization of logging');
        logDiv = initializeLogging();
    }
}, 1000);

function visualLog(message, type = 'info') {
    console.log('Attempting to log:', message);
    
    // Make sure logDiv exists
    if (!logDiv || !document.getElementById('claude-extension-log')) {
        console.log('Log div not found, reinitializing');
        logDiv = initializeLogging();
    }
    
    const color = type === 'error' ? '#ff4444' : '#00ff00';
    console.log(message);
    
    const entry = document.createElement('div');
    entry.style.cssText = `
        border-bottom: 1px solid ${color};
        margin-bottom: 5px;
        padding: 5px 0;
        color: ${color};
        word-wrap: break-word;
    `;
    entry.textContent = new Date().toISOString().split('T')[1].split('.')[0] + ' - ' + message;
    logDiv.appendChild(entry);
    
    // Scroll to bottom
    logDiv.scrollTop = logDiv.scrollHeight;
    
    // Keep only last 50 messages
    while (logDiv.children.length > 50) {
        logDiv.removeChild(logDiv.firstChild);
    }
}

// Test the visual logging system immediately
setTimeout(() => {
    visualLog('🔄 Testing logging system');
    visualLog('If you see this message in the overlay, logging is working');
}, 2000);

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received in content script:', request);
    
    if (request.action === 'log') {
        // Handle log messages
        visualLog(request.message, request.type || 'info');
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action !== 'log') {
        const unknownMsg = '⚠️ Unknown action: ' + request.action;
        visualLog(unknownMsg, 'error');
        console.log(unknownMsg);
    }
    sendResponse({ success: true });
    return true;
});