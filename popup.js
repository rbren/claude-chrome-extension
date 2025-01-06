// Accessibility functions are available via AccessibilityTree global

function toYAML(obj, indent = 0) {
    if (obj === null || obj === undefined) return '';
    const spaces = ' '.repeat(indent);
    
    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        return '\n' + obj.map(item => `${spaces}- ${toYAML(item, indent + 2).trimStart()}`).join('\n');
    }
    
    if (typeof obj === 'object') {
        const entries = Object.entries(obj)
            .filter(([_, v]) => v !== null && v !== undefined && v !== false);
        if (entries.length === 0) return '{}';
        return entries
            .map(([k, v]) => {
                const valueStr = toYAML(v, indent + 2);
                if (typeof v === 'object') {
                    return `${spaces}${k}:${valueStr}`;
                }
                return `${spaces}${k}: ${valueStr}`;
            })
            .join('\n');
    }
    
    return String(obj);
}

function addMessage(text, type = 'user') {
    const chatContainer = document.querySelector('.chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

function addLoadingMessage() {
    const chatContainer = document.querySelector('.chat-container');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message loading-message';
    loadingDiv.innerHTML = `
        Thinking
        <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
}

function getCurrentTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error('No active tab found');
            return;
        }
        const tab = tabs[0];
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            console.error('Cannot access tab:', tab.url);
            return;
        }
        callback(tab);
    });
}

function executeInTab(code, callback) {
    getCurrentTab(function(tab) {
        // First inject a wrapper function
        const wrapperCode = `
            (function() {
                try {
                    const result = eval(${JSON.stringify(code)});
                    return { success: true, result: result };
                } catch (error) {
                    return { success: false, error: error.toString() };
                }
            })();
        `;
        
        chrome.tabs.executeScript(tab.id, {
            code: wrapperCode
        }, function(results) {
            if (chrome.runtime.lastError) {
                callback({ success: false, error: chrome.runtime.lastError.message });
            } else {
                callback(results[0]);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const litellmKeyInput = document.getElementById('litellmKey');
    const litellmUrlInput = document.getElementById('litellmUrl');
    const litellmModelInput = document.getElementById('litellmModel');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    const additionalPromptInput = document.getElementById('additionalPrompt');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    async function handleSend() {
        const prompt = userInput.value.trim();
        if (!prompt) return;

        // Check settings
        if (!litellmKeyInput.value || !litellmUrlInput.value || !litellmModelInput.value) {
            addMessage('Please fill in all settings fields (API Key, URL, and Model)', 'error');
            return;
        }

        // Add user message and loading indicator
        addMessage(prompt);
        const loadingMessage = addLoadingMessage();
        userInput.value = '';
        sendButton.disabled = true;

        try {
            // Get the accessibility tree
            const accessibilityTree = await new Promise((resolve) => {
                getCurrentTab((tab) => {
                    // First inject accessibility.js
                    chrome.tabs.executeScript(tab.id, {
                        file: 'accessibility.js'
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Error injecting script:', chrome.runtime.lastError);
                            resolve(null);
                            return;
                        }
                        // Then execute the tree building
                        chrome.tabs.executeScript(tab.id, {
                            code: 'AccessibilityTree.buildAccessibilityTree(document.body)'
                        }, (results) => {
                            if (chrome.runtime.lastError) {
                                console.error('Error executing script:', chrome.runtime.lastError);
                                resolve(null);
                                return;
                            }
                            resolve(results[0]);
                        });
                    });
                });
            });

            if (!accessibilityTree) {
                throw new Error('Failed to get accessibility tree from the active tab');
            }
            // Convert to YAML
            const yamlOutput = toYAML(accessibilityTree);
            addMessage(yamlOutput, 'system');
        } catch (error) {
            addMessage('Error: ' + error.message, 'error');
        } finally {
            loadingMessage.remove();
            sendButton.disabled = false;
        }
    }

    // Handle send button click
    sendButton.addEventListener('click', handleSend);

    // Handle Enter key
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Tab switching logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Update tab buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update tab contents
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });

    // Load saved values
    chrome.storage.local.get(['litellmKey', 'litellmUrl', 'litellmModel', 'additionalPrompt'], function(result) {
        if (result.litellmKey) litellmKeyInput.value = result.litellmKey;
        if (result.litellmUrl) litellmUrlInput.value = result.litellmUrl;
        if (result.litellmModel) litellmModelInput.value = result.litellmModel;
        if (result.additionalPrompt) additionalPromptInput.value = result.additionalPrompt;
    });

    // Save values when they change
    litellmKeyInput.addEventListener('change', () => {
        chrome.storage.local.set({ litellmKey: litellmKeyInput.value });
    });
    litellmUrlInput.addEventListener('change', () => {
        chrome.storage.local.set({ litellmUrl: litellmUrlInput.value });
    });
    litellmModelInput.addEventListener('change', () => {
        chrome.storage.local.set({ litellmModel: litellmModelInput.value });
    });
    additionalPromptInput.addEventListener('change', () => {
        chrome.storage.local.set({ additionalPrompt: additionalPromptInput.value });
    });
});

// Alias for backward compatibility
const getAccessibilityTree = AccessibilityTree.buildAccessibilityTree;