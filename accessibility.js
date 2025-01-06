// Function to check if node should be included in the tree
function shouldIncludeNode(node) {
    // Skip comment nodes and empty text nodes
    if (node.nodeType === Node.COMMENT_NODE || 
        (node.nodeType === Node.TEXT_NODE && !node.textContent.trim())) {
        return false;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        // Skip script, style, meta tags
        if (['script', 'style', 'meta', 'link', 'noscript'].includes(tagName)) {
            return false;
        }

        try {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();

            // Keep elements that are visually hidden but may be important for accessibility
            if (node.getAttribute('aria-label') ||
                node.getAttribute('aria-description') ||
                node.getAttribute('role') ||
                node.getAttribute('title')) {
                return true;
            }

            // Skip truly hidden elements, but be more lenient with dynamic content
            if ((style.display === 'none' || style.visibility === 'hidden') &&
                !node.getAttribute('aria-hidden') && // Keep aria-hidden elements as they may be important for accessibility
                !node.getAttribute('role') && // Keep elements with roles
                rect.width === 0 && rect.height === 0) { // Only skip if also has no dimensions
                return false;
            }
        } catch (e) {
            // Don't skip the node if we can't check its style
        }
    }

    return true;
}

// Function to get direct text content (excluding child elements)
function getDirectTextContent(node) {
    return Array.from(node.childNodes)
        .filter(child => child.nodeType === Node.TEXT_NODE)
        .map(child => child.textContent.trim())
        .filter(text => text)
        .join(' ');
}

// Function to extract element attributes and properties
function getAccessibleProperties(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return {};
    }

    const properties = {};

    // Get all attributes
    for (const attr of node.attributes) {
        properties[attr.name] = attr.value;
    }

    // Get direct text content if any
    const directText = getDirectTextContent(node);
    if (directText) {
        properties.textContent = directText;
    }

    // Add element type
    properties.tagName = node.tagName.toLowerCase();

    // Add input-specific properties
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
        if (node.value) properties.value = node.value;
        if (node.checked !== undefined) properties.checked = node.checked;
        if (node.disabled !== undefined) properties.disabled = node.disabled;
        if (node.readOnly !== undefined) properties.readOnly = node.readOnly;
    }

    return properties;
}

// Function to check if a node is a container that just wraps other elements
function isSimpleContainer(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    
    const tagName = node.tagName.toLowerCase();
    
    // Never treat semantic elements as simple containers
    const semanticElements = [
        'main', 'nav', 'article', 'section', 'aside', 'header', 'footer',
        'button', 'a', 'select', 'input', 'textarea', 'form',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'
    ];
    if (semanticElements.includes(tagName)) {
        return false;
    }
    
    // Never treat elements with ARIA attributes or roles as simple containers
    if (node.getAttribute('role') ||
        node.getAttribute('aria-label') ||
        node.getAttribute('aria-description') ||
        node.getAttribute('aria-hidden') ||
        node.getAttribute('title')) {
        return false;
    }
    
    // Skip if node has meaningful properties
    const props = getAccessibleProperties(node);
    const meaningfulProps = Object.keys(props).filter(key => 
        key !== 'tagName' && // Ignore basic properties
        key !== 'class' &&
        key !== 'id' &&
        key !== 'style'
    );
    if (meaningfulProps.length > 0) {
        return false;
    }

    // Skip if node has text content directly
    const hasDirectText = Array.from(node.childNodes).some(child => 
        child.nodeType === Node.TEXT_NODE && child.textContent.trim());
    if (hasDirectText) {
        return false;
    }

    return true;
}

// Function to find repetitive structures in an array of nodes
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

// Function to truncate repetitive sections in the tree
function truncateRepetitiveStructures(node) {
    if (!node || typeof node !== 'object') return node;
    
    // Process arrays
    if (Array.isArray(node)) {
        const pattern = findRepetitiveStructure(node);
        if (pattern && pattern.repetitions > 3) {
            const patternLength = pattern.length;
            const repsToShow = Math.min(3, pattern.repetitions - 1);
            const repsAtEnd = Math.min(3, pattern.repetitions - repsToShow - 1);
            return [
                ...node.slice(0, patternLength * repsToShow),
                {
                    type: 'text',
                    content: `[... ${pattern.repetitions - (repsToShow + 1)} more similar ${patternLength === 1 ? 'items' : 'groups'} omitted ...]`
                },
                ...node.slice(patternLength * (pattern.repetitions - repsAtEnd))
            ];
        }
        return node.map(truncateRepetitiveStructures);
    }
    
    // Process objects
    if (node.children) {
        node.children = truncateRepetitiveStructures(node.children);
    }
    return node;
}

// Main function to build the accessibility tree
function buildAccessibilityTree(element = document.body) {
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

// Export functions for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = {
        shouldIncludeNode,
        isSimpleContainer,
        getAccessibleProperties,
        getDirectTextContent,
        findRepetitiveStructure,
        truncateRepetitiveStructures,
        buildAccessibilityTree
    };
} else {
    // Browser
    window.AccessibilityTree = {
        shouldIncludeNode,
        isSimpleContainer,
        getAccessibleProperties,
        getDirectTextContent,
        findRepetitiveStructure,
        truncateRepetitiveStructures,
        buildAccessibilityTree
    };
}