function addMessage(text, type = 'user') {
    const chatContainer = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function getCurrentTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        callback(tabs[0]);
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

    // Load saved values
    chrome.storage.local.get(['litellmKey', 'litellmUrl', 'litellmModel'], function(result) {
        if (result.litellmKey) litellmKeyInput.value = result.litellmKey;
        if (result.litellmUrl) litellmUrlInput.value = result.litellmUrl;
        if (result.litellmModel) litellmModelInput.value = result.litellmModel;
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

    async function handleSend() {
        const prompt = userInput.value.trim();
        if (!prompt) return;

        // Check settings
        if (!litellmKeyInput.value || !litellmUrlInput.value || !litellmModelInput.value) {
            addMessage('Please fill in all settings fields (API Key, URL, and Model)', 'error');
            return;
        }

        // Add user message
        addMessage(prompt);
        userInput.value = '';
        sendButton.disabled = true;

        try {
            // Make API request
            const response = await fetch(litellmUrlInput.value + '/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${litellmKeyInput.value}`
                },
                body: JSON.stringify({
                    model: litellmModelInput.value,
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

            // Show the generated code
            addMessage('Generated code:', 'system');
            addMessage(code, 'system');

            // Execute the code
            addMessage('Executing code...', 'system');
            executeInTab(code, function(result) {
                if (result.success) {
                    addMessage('Result: ' + JSON.stringify(result.result, null, 2), 'system');
                } else {
                    addMessage('Execution error: ' + result.error, 'error');
                }
                sendButton.disabled = false;
                userInput.focus();
            });

        } catch (error) {
            addMessage('Error: ' + error.toString(), 'error');
        }

        sendButton.disabled = false;
        userInput.focus();
    }

    // Handle send button click
    sendButton.addEventListener('click', handleSend);

    // Handle Enter key (with Shift+Enter for new line)
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
});