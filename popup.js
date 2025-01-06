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

function getAccessibilityTree(element = document.body) {
    // Function to get direct text content (excluding child elements)
    function getDirectTextContent(node) {
        return Array.from(node.childNodes)
            .filter(child => child.nodeType === Node.TEXT_NODE)
            .map(child => child.textContent.trim())
            .filter(text => text)
            .join(' ');
    }

    // Function to extract key accessibility properties
    function getAccessibleProperties(node) {
        const properties = {};

        // Get explicit role only
        const role = node.getAttribute('role');
        if (role) properties.role = role;

        // Get name from explicit attributes first
        let name = node.getAttribute('aria-label') || node.getAttribute('alt');
        
        // Only use text content if:
        // 1. No explicit name was found
        // 2. The node has direct text (not just from children)
        // 3. The node is a leaf element or is meant to aggregate text (like buttons, links)
        if (!name) {
            const directText = getDirectTextContent(node);
            const isLeafOrTextAggregator = 
                node.children.length === 0 || 
                ['button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName.toLowerCase());
            
            if (directText && isLeafOrTextAggregator) {
                name = directText;
            }
        }
        
        if (name) properties.name = name;

        // Get class names if present
        if (node.className && typeof node.className === 'string' && node.className.trim()) {
            properties.class = node.className.trim();
        }

        // Get ID if present
        if (node.id && node.id.trim()) {
            properties.id = node.id.trim();
        }

        // Get states (only include true values)
        const states = {};
        if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') {
            states.disabled = true;
        }
        if (node.getAttribute('aria-expanded') === 'true') {
            states.expanded = true;
        }
        if (node.getAttribute('aria-checked') === 'true' || 
            (node.tagName === 'INPUT' && node.type === 'checkbox' && node.checked)) {
            states.checked = true;
        }
        if (Object.keys(states).length > 0) {
            properties.state = states;
        }

        return properties;
    }


    // Function to check if node should be included in the tree
    function shouldIncludeNode(node) {
        // Skip comment nodes and empty text nodes
        if (node.nodeType === Node.COMMENT_NODE || 
            (node.nodeType === Node.TEXT_NODE && !node.textContent.trim())) {
            return false;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            const style = getComputedStyle(node);

            // Skip hidden elements
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }

            // Skip script, style, meta tags
            if (['script', 'style', 'meta', 'link', 'noscript'].includes(tagName)) {
                return false;
            }
        }

        return true;
    }

    // Function to check if a node is a container that just wraps other elements
    function isSimpleContainer(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        
        // Never treat semantic elements as simple containers
        const semanticElements = [
            'main', 'nav', 'article', 'section', 'aside', 'header', 'footer',
            'button', 'a', 'select', 'input', 'textarea', 'form',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'
        ];
        if (semanticElements.includes(node.tagName.toLowerCase())) return false;
        
        // Skip if node has meaningful properties
        const props = getAccessibleProperties(node);
        if (Object.keys(props).length > 0) return false;

        // Skip if node has text content directly
        const hasDirectText = Array.from(node.childNodes).some(child => 
            child.nodeType === Node.TEXT_NODE && child.textContent.trim());
        if (hasDirectText) return false;

        return true;
    }

    // Main recursive function to build the tree
    function buildTree(node) {
        if (!shouldIncludeNode(node)) {
            return null;
        }

        // For text nodes, just return the trimmed content if not empty
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            return text ? { type: 'text', content: text } : null;
        }

        // Process children first
        let children = Array.from(node.childNodes)
            .map(buildTree)
            .filter(child => child !== null);

        // For simple container elements, just return their children
        if (isSimpleContainer(node) && children.length > 0) {
            return children.length === 1 ? children[0] : children;
        }

        // For element nodes, build the node structure
        const accessibleNode = {
            type: 'element',
            tagName: node.tagName.toLowerCase(),
            ...getAccessibleProperties(node)
        };

        // Only include children if there are any
        if (children.length > 0) {
            // If a child is an array (from a simple container), flatten it
            children = children.flat();
            // Remove duplicate adjacent text nodes
            children = children.filter((child, i) => {
                if (i === 0) return true;
                if (child.type === 'text' && children[i - 1].type === 'text') {
                    return child.content !== children[i - 1].content;
                }
                return true;
            });
            accessibleNode.children = children;
        }

        return accessibleNode;
    }

    return buildTree(element);
}

function addMessage(text, type = 'user') {
    const chatContainer = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

function addLoadingMessage() {
    const chatContainer = document.getElementById('chat-container');
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
    // Get the currently focused window
    chrome.windows.getLastFocused((focusedWindow) => {
        // Get the active tab in that window
        chrome.tabs.query({ active: true, windowId: focusedWindow.id }, (tabs) => {
            if (tabs.length > 0 && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
                callback(tabs[0]);
            }
        });
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

        // Add user message and loading indicator
        addMessage(prompt);
        const loadingMessage = addLoadingMessage();
        userInput.value = '';
        sendButton.disabled = true;

        try {
            // First get the accessibility tree
            const accessibilityTree = await new Promise((resolve) => {
                chrome.tabs.executeScript({
                    code: `const tree = (${getAccessibilityTree.toString()})();
                        tree;`
                }, function(results) {
                    if (chrome.runtime.lastError) {
                        console.error('Error getting accessibility tree:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(results[0]);
                    }
                });
            });
            let a11yTree = toYAML(accessibilityTree);
            if (a11yTree.length > 100000) {
                a11yTree = a11yTree.slice(0, 100000) + '\n...';
            }

            // Make API request with accessibility context
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
                        content: `
<ACCESSIBILITY_TREE>
${a11yTree}
</ACCESSIBILITY_TREE>

<TASK>
Generate JavaScript code for this task: ${prompt}
Only provide the code, no explanations.

Your code will be passed to "eval". It is NOT the body of a function, and should not end with a return statement.
The last value in the code will be shown to the user. This is a good place to
put a message describing what happened with the execution.

Make your JavaScript as general as possible. It should be able to handle ambiguity
like escaped characters, missing elements, etc.

DO NOT assume anything about the page other than what you see in the accessibility tree.
Other tags, data attributes, etc should not be assumed to exist.

When possible, use controls present on the page to search, filter, etc. If you need to,
use string matching to process text content.
</TASK>
`

                    }]
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const data = await response.json();
            let code = data.choices[0].message.content;
            
            // Parse code blocks if present
            if (code.includes('```javascript')) {
                const match = code.match(/```javascript\n([\s\S]*?)```/);
                if (match) {
                    code = match[1].trim();
                }
            } else if (code.includes('```')) {
                const match = code.match(/```\n?([\s\S]*?)```/);
                if (match) {
                    code = match[1].trim();
                }
            }

            // Execute the code
            executeInTab(code, function(result) {
                // Remove loading message
                loadingMessage.remove();

                const response = [
                    'Generated code:\n' + code + '\n',
                    result.success ? 
                        'Result: ' + JSON.stringify(result.result, null, 2) :
                        'Error: ' + result.error
                ].join('\n');
                
                addMessage(response, result.success ? 'system' : 'error');
                sendButton.disabled = false;
                userInput.focus();
            });

        } catch (error) {
            loadingMessage.remove();
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
