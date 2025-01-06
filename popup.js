function truncateSection(obj) {
    const serialized = JSON.stringify(obj);
    if (serialized.length > 25000) {
        if (Array.isArray(obj)) {
            // For arrays, keep first few items that fit within limit
            let truncated = [];
            let currentSize = 2; // Account for [] in JSON
            for (let item of obj) {
                const itemStr = JSON.stringify(item);
                if (currentSize + itemStr.length + 1 > 25000) {
                    break;
                }
                truncated.push(item);
                currentSize += itemStr.length + 1; // +1 for comma
            }
            return {
                _truncated: `Array truncated from ${obj.length} to ${truncated.length} items`,
                _items: truncated
            };
        } else {
            // For objects, keep a summary
            return {
                _truncated: `Object truncated, original size: ${serialized.length} chars`,
                _summary: {
                    type: obj.type,
                    tagName: obj.tagName,
                    childCount: obj.children ? obj.children.length : 0
                }
            };
        }
    }
    return obj;
}

function toYAML(obj, indent = 0) {
    if (obj === null || obj === undefined) return '';
    const spaces = ' '.repeat(indent);
    
    // Check size and potentially truncate before processing
    obj = truncateSection(obj);
    
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
            console.log('Skipping node: Comment or empty text');
            return false;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            console.log('Checking element:', tagName);
            
            try {
                const style = getComputedStyle(node);

                // Skip hidden elements
                if (style.display === 'none' || style.visibility === 'hidden') {
                    console.log('Skipping hidden element:', tagName);
                    return false;
                }

                // Skip script, style, meta tags
                if (['script', 'style', 'meta', 'link', 'noscript'].includes(tagName)) {
                    console.log('Skipping excluded tag:', tagName);
                    return false;
                }
            } catch (e) {
                console.error('Error checking style for', tagName, ':', e);
                // Don't skip the node if we can't check its style
            }
        }

        return true;
    }

    // Function to check if a node is a container that just wraps other elements
    function isSimpleContainer(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        
        const tagName = node.tagName.toLowerCase();
        console.log('Checking if simple container:', tagName);
        
        // Never treat semantic elements as simple containers
        const semanticElements = [
            'main', 'nav', 'article', 'section', 'aside', 'header', 'footer',
            'button', 'a', 'select', 'input', 'textarea', 'form',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'
        ];
        if (semanticElements.includes(tagName)) {
            console.log('Not a simple container - semantic element:', tagName);
            return false;
        }
        
        // Skip if node has meaningful properties
        const props = getAccessibleProperties(node);
        if (Object.keys(props).length > 0) {
            console.log('Not a simple container - has properties:', tagName, props);
            return false;
        }

        // Skip if node has text content directly
        const hasDirectText = Array.from(node.childNodes).some(child => 
            child.nodeType === Node.TEXT_NODE && child.textContent.trim());
        if (hasDirectText) {
            console.log('Not a simple container - has direct text:', tagName);
            return false;
        }

        console.log('Is a simple container:', tagName);
        return true;
    }

    // Main recursive function to build the tree
    function findRepetitiveStructure(children) {
        if (children.length < 4) return null; // Need at least 4 items to detect pattern
        
        // Function to get a simple structural hash of a node
        function getStructuralHash(node) {
            if (!node || typeof node !== 'object') return '';
            if (node.type === 'text') return 'text';
            return `${node.type}:${node.tagName}:${node.children ? node.children.length : 0}`;
        }

        // Get structural hashes for all children
        const hashes = children.map(getStructuralHash);
        
        // Look for repeating patterns
        let maxPatternLength = Math.floor(children.length / 2); // Pattern must repeat at least twice
        for (let len = 1; len <= maxPatternLength; len++) {
            let isPattern = true;
            const pattern = hashes.slice(0, len).join('|');
            
            // Check if this pattern repeats
            for (let i = len; i < hashes.length; i += len) {
                const nextSection = hashes.slice(i, i + len).join('|');
                if (nextSection && nextSection !== pattern) {
                    isPattern = false;
                    break;
                }
            }
            
            if (isPattern && pattern) {
                return {
                    length: len,
                    repetitions: Math.floor(children.length / len)
                };
            }
        }
        
        return null;
    }

    function buildTree(node) {
        console.log('Building tree for:', node.nodeType === Node.ELEMENT_NODE ? node.tagName : 'text/comment');
        
        if (!shouldIncludeNode(node)) {
            console.log('Node excluded by shouldIncludeNode');
            return null;
        }

        // For text nodes, just return the trimmed content if not empty
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            console.log('Text node:', text ? 'has content' : 'empty');
            return text ? { type: 'text', content: text } : null;
        }

        // Process children first
        console.log('Processing children of:', node.tagName);
        let children = Array.from(node.childNodes)
            .map(buildTree)
            .filter(child => child !== null);
        console.log('Found children:', children.length);

        // For simple container elements, just return their children
        if (isSimpleContainer(node) && children.length > 0) {
            console.log('Returning children of simple container:', node.tagName);
            return children.length === 1 ? children[0] : children;
        }

        // For element nodes, build the node structure
        console.log('Building element node:', node.tagName);
        const accessibleNode = {
            type: 'element',
            tagName: node.tagName.toLowerCase(),
            ...getAccessibleProperties(node)
        };
        console.log('Node properties:', accessibleNode);

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

            // Check for repetitive structures in children
            const pattern = findRepetitiveStructure(children);
            if (pattern && pattern.repetitions > 3) { // If pattern repeats more than 3 times
                // Keep first two repetitions and last repetition
                const patternLength = pattern.length;
                const truncatedChildren = [
                    ...children.slice(0, patternLength * 2), // First two repetitions
                    {
                        type: 'text',
                        content: `[... ${pattern.repetitions - 3} more similar ${patternLength === 1 ? 'items' : 'groups'} omitted ...]`
                    },
                    ...children.slice(patternLength * (pattern.repetitions - 1)) // Last repetition
                ];
                accessibleNode.children = truncatedChildren;
                console.log(`Truncated repetitive section: pattern length ${patternLength}, ${pattern.repetitions} repetitions`);
            } else {
                accessibleNode.children = children;
            }
            console.log('Added children to node:', node.tagName);
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
                const debugCode = `
                    try {
                        console.log("Starting to build accessibility tree...");
                        const treeFunc = ${getAccessibilityTree.toString()};
                        console.log("Tree function defined");
                        const tree = treeFunc();
                        console.log("Tree built:", tree ? "success" : "null");
                        if (!tree) {
                            console.log("Document body:", document.body ? "exists" : "null");
                            console.log("First level children:", document.body ? Array.from(document.body.children).map(c => c.tagName).join(", ") : "N/A");
                        }

                        // Function to estimate size of a node
                        function estimateSize(node) {
                            if (!node || typeof node !== 'object') return 0;
                            let size = 0;
                            
                            // Add size for node properties
                            size += JSON.stringify({
                                type: node.type,
                                tagName: node.tagName,
                                ...node
                            }).length;
                            
                            // Add size for children
                            if (node.children) {
                                size += node.children.reduce((acc, child) => acc + estimateSize(child), 0);
                            }
                            
                            return size;
                        }

                        // Function to truncate large sections while preserving structure
                        function truncateLargeSections(node, maxSectionSize = 25000) {
                            if (!node || typeof node !== 'object') return node;
                            
                            // Process children first if they exist
                            if (node.children && node.children.length > 0) {
                                // First pass: truncate any oversized children
                                node.children = node.children.map(child => {
                                    const childSize = estimateSize(child);
                                    if (childSize > maxSectionSize) {
                                        console.log(\`Truncating large section: \${child.tagName || 'text'} (\${childSize} chars)\`);
                                        return truncateLargeSections(child, maxSectionSize);
                                    }
                                    return child;
                                });
                                
                                // Second pass: look for repetitive sections
                                const pattern = findRepetitiveStructure(node.children);
                                if (pattern && pattern.repetitions > 3) {
                                    const patternLength = pattern.length;
                                    node.children = [
                                        ...node.children.slice(0, patternLength * 2),
                                        {
                                            type: 'text',
                                            content: \`[... \${pattern.repetitions - 3} more similar \${patternLength === 1 ? 'items' : 'groups'} omitted ...]\`
                                        },
                                        ...node.children.slice(patternLength * (pattern.repetitions - 1))
                                    ];
                                }
                            }
                            
                            return node;
                        }

                        // Truncate large sections before returning
                        const processedTree = truncateLargeSections(tree);
                        processedTree;  // Return value for executeScript
                    } catch (e) {
                        console.error("Error building tree:", e);
                        throw e;
                    }
                `;
                chrome.tabs.executeScript({
                    code: debugCode
                }, function(results) {
                    if (chrome.runtime.lastError) {
                        console.error('Error getting accessibility tree:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        console.log('Tree script executed, result:', results ? results[0] : 'no results');
                        resolve(results[0]);
                    }
                });
            });
            
            if (!accessibilityTree) {
                throw new Error('Failed to generate accessibility tree. Check the console for debug information.');
            }
            
            let a11yTree = toYAML(accessibilityTree);

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
