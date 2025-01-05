function getAccessibilityTree(element = document.body) {
    // Function to extract key accessibility properties
    function getAccessibleProperties(node) {
        const props = {};
        
        // Get role (only if it's explicit or a meaningful implicit role)
        const role = node.getAttribute('role') || computedRole(node);
        if (role && !['generic', 'presentation'].includes(role)) {
            props.role = role;
        }

        // Get name (prefer shorter identifiers)
        const name = node.getAttribute('aria-label') || 
                    node.getAttribute('alt') || 
                    node.getAttribute('title') ||
                    (node.textContent?.trim()?.slice(0, 50));
        if (name) props.name = name;

        // Only include states that are true/present
        const states = [];
        if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') {
            states.push('disabled');
        }
        if (node.getAttribute('aria-expanded') === 'true') {
            states.push('expanded');
        }
        if (node.getAttribute('aria-checked') === 'true' || 
            (node.tagName === 'INPUT' && node.type === 'checkbox' && node.checked)) {
            states.push('checked');
        }
        if (states.length > 0) {
            props.state = states;
        }

        return props;
    }

    // Function to compute implicit role if none is explicitly set
    function computedRole(node) {
        const tagRoleMap = {
            'button': 'button',
            'a': 'link',
            'input': node.type === 'text' ? 'textbox' : 
                     node.type === 'checkbox' ? 'checkbox' : 
                     node.type === 'radio' ? 'radio' : '',
            'select': 'combobox',
            'textarea': 'textbox',
            'img': 'img',
            'table': 'table',
            'ul': 'list',
            'ol': 'list',
            'li': 'listitem',
            'nav': 'navigation',
            'main': 'main',
            'header': 'banner',
            'footer': 'contentinfo',
            'aside': 'complementary',
            'article': 'article',
            'form': 'form',
            'search': 'search'
        };
        
        return tagRoleMap[node.tagName.toLowerCase()] || '';
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

            // Skip tracking, analytics, and ad-related elements
            if (node.id?.toLowerCase().includes('tracking') ||
                node.id?.toLowerCase().includes('analytics') ||
                node.id?.toLowerCase().includes('ads') ||
                node.className?.toLowerCase().includes('tracking') ||
                node.className?.toLowerCase().includes('analytics') ||
                node.className?.toLowerCase().includes('ads')) {
                return false;
            }

            // Skip elements with no meaningful content or interaction
            if (!node.hasChildNodes() && 
                !node.onclick && 
                !node.getAttribute('role') &&
                !node.getAttribute('aria-label') &&
                !node.getAttribute('alt') &&
                !node.textContent?.trim() &&
                !['img', 'input', 'button', 'select', 'textarea'].includes(tagName)) {
                return false;
            }

            // Skip decorative elements
            if (node.getAttribute('aria-hidden') === 'true' ||
                node.getAttribute('role') === 'presentation' ||
                (tagName === 'img' && node.getAttribute('role') === 'presentation')) {
                return false;
            }

            // Skip elements that are too small to be meaningful
            const rect = node.getBoundingClientRect();
            if (rect.width < 5 || rect.height < 5) {
                return false;
            }
        }

        return true;
    }

    // Main recursive function to build the tree
    function buildTree(node) {
        if (!shouldIncludeNode(node)) {
            return null;
        }

        // For text nodes, just return the trimmed content if it's meaningful
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            // Skip very short text or numbers only
            if (!text || text.length < 3 || /^[\d\s.,]+$/.test(text)) {
                return null;
            }
            return { type: 'text', content: text };
        }

        // For element nodes, build the full node structure
        const accessibleNode = {
            type: 'element',
            tagName: node.tagName.toLowerCase()
        };

        // Get accessible properties
        const props = getAccessibleProperties(node);
        
        // Only include properties that have meaningful values
        if (Object.keys(props).length > 0) {
            Object.assign(accessibleNode, props);
        }

        // Recursively process child nodes
        const children = Array.from(node.childNodes)
            .map(buildTree)
            .filter(child => child !== null);

        // Skip wrapper elements that only have one child and no meaningful properties
        if (children.length === 1 && Object.keys(props).length === 0) {
            return children[0];
        }

        // Skip empty branches
        if (children.length === 0 && Object.keys(props).length === 0) {
            return null;
        }

        if (children.length > 0) {
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

        // Add user message and loading indicator
        addMessage(prompt);
        const loadingMessage = addLoadingMessage();
        userInput.value = '';
        sendButton.disabled = true;

        try {
            // First get the accessibility tree
            const accessibilityTree = await new Promise((resolve) => {
                chrome.tabs.executeScript({
                    code: `
                        const tree = (${getAccessibilityTree.toString()})();
                        console.log('Accessibility Tree:', JSON.stringify(tree, null, 2));
                        console.log('Tree size (chars):', JSON.stringify(tree).length);
                        console.log('Tree size (tokens, approx):', Math.ceil(JSON.stringify(tree).length / 4));
                        tree;
                    `
                }, function(results) {
                    if (chrome.runtime.lastError) {
                        console.error('Error getting accessibility tree:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(results[0]);
                    }
                });
            });

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
Page accessibility tree:
${JSON.stringify(accessibilityTree, null, 2)}

Generate JavaScript code for this task: ${prompt}
Only provide the code, no explanations.`
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