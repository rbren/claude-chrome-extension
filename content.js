console.log('🟢 Content script loaded - ' + new Date().toISOString());

// Wait for DOM to be ready
function initializeUI() {
    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.id = 'claude-extension-toggle';
    toggleButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 20px;
        height: 20px;
        background: #00ff00;
        border-radius: 50%;
        cursor: pointer;
        z-index: 2147483647;
        box-shadow: 0 0 10px rgba(0,255,0,0.5);
        transition: all 0.3s ease;
    `;
    toggleButton.title = 'Toggle Claude Console';
    
    // Create console UI
    const consoleUI = document.createElement('div');
    consoleUI.id = 'claude-extension-console';
    consoleUI.style.cssText = `
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
        z-index: 2147483646;
        border: 2px solid #00ff00;
        box-shadow: 0 0 10px rgba(0,255,0,0.5);
        display: none;
        flex-direction: column;
    `;

    // Create log area
    const logArea = document.createElement('div');
    logArea.id = 'claude-extension-log';
    logArea.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        margin-bottom: 10px;
        padding: 10px;
        border: 1px solid #00ff00;
        border-radius: 5px;
    `;

    // Create input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
        display: flex;
        gap: 10px;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter your prompt...';
    input.style.cssText = `
        flex-grow: 1;
        background: #000000;
        color: #00ff00;
        border: 1px solid #00ff00;
        padding: 8px;
        border-radius: 5px;
        font-family: monospace;
    `;

    const button = document.createElement('button');
    button.textContent = 'Send';
    button.style.cssText = `
        background: #00ff00;
        color: #000000;
        border: none;
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        font-family: monospace;
        font-weight: bold;
    `;

    inputArea.appendChild(input);
    inputArea.appendChild(button);
    consoleUI.appendChild(logArea);
    consoleUI.appendChild(inputArea);

    document.body.appendChild(toggleButton);
    document.body.appendChild(consoleUI);

    // Add toggle functionality
    toggleButton.onclick = function() {
        const isVisible = consoleUI.style.display === 'flex';
        consoleUI.style.display = isVisible ? 'none' : 'flex';
        toggleButton.style.transform = isVisible ? 'scale(1)' : 'scale(1.2)';
    };

    // Add send functionality
    button.onclick = function() {
        if (input.value.trim()) {
            visualLog('🔵 Sending prompt: ' + input.value);
            sendToLiteLLM(input.value);
            input.value = '';
        }
    };

    input.onkeypress = function(e) {
        if (e.key === 'Enter' && input.value.trim()) {
            button.click();
        }
    };

    return { logArea, consoleUI, toggleButton };
}

let ui;

// Initialize UI
function initializeIfNeeded() {
    if (!document.getElementById('claude-extension-toggle')) {
        ui = initializeUI();
    }
}

// Try to initialize immediately
initializeIfNeeded();

// Try again when DOM is ready
document.addEventListener('DOMContentLoaded', initializeIfNeeded);

// And once more after a delay
setTimeout(initializeIfNeeded, 1000);

function visualLog(message, type = 'info') {
    const logArea = document.getElementById('claude-extension-log');
    if (!logArea) return;
    
    const color = type === 'error' ? '#ff4444' : '#00ff00';
    
    const entry = document.createElement('div');
    entry.style.cssText = `
        border-bottom: 1px solid ${color};
        margin-bottom: 5px;
        padding: 5px 0;
        color: ${color};
        word-wrap: break-word;
    `;
    entry.textContent = new Date().toISOString().split('T')[1].split('.')[0] + ' - ' + message;
    logArea.appendChild(entry);
    
    // Scroll to bottom
    logArea.scrollTop = logArea.scrollHeight;
    
    // Keep only last 50 messages
    while (logArea.children.length > 50) {
        logArea.removeChild(logArea.firstChild);
    }
}

async function sendToLiteLLM(prompt) {
    try {
        // Get settings from storage
        const settings = await new Promise(resolve => {
            chrome.storage.local.get(['litellmKey', 'litellmUrl', 'litellmModel'], resolve);
        });

        if (!settings.litellmKey || !settings.litellmUrl || !settings.litellmModel) {
            visualLog('❌ Missing LiteLLM settings. Click the extension icon to configure.', 'error');
            return;
        }

        visualLog('🌐 Sending request to LiteLLM...');
        
        const response = await fetch(settings.litellmUrl + '/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.litellmKey}`
            },
            body: JSON.stringify({
                model: settings.litellmModel,
                messages: [{
                    role: 'user',
                    content: `Generate JavaScript code for the following task. Only provide the code, no explanations: ${prompt}`
                }]
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        const code = data.choices[0].message.content;
        
        visualLog('📝 Generated code:');
        visualLog(code);
        
        visualLog('⚡ Executing code...');
        try {
            const result = eval(code);
            visualLog('✅ Code execution result: ' + JSON.stringify(result));
        } catch (error) {
            visualLog('❌ Execution error: ' + error.toString(), 'error');
        }
    } catch (error) {
        visualLog('❌ Error: ' + error.toString(), 'error');
    }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'log') {
        visualLog(request.message, request.type || 'info');
        sendResponse({ success: true });
        return true;
    }
    
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
        return true;
    }
    
    sendResponse({ success: false, error: 'Unknown action' });
    return true;
});