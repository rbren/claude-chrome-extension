function toYAML(obj, indent = 0) {
    if (obj === null || obj === undefined) return '';
    const spaces = ' '.repeat(indent);
    
    if (Array.isArray(obj)) {
        return obj.map(item => spaces + '- ' + toYAML(item, indent + 2)).join('\n');
    }
    
    if (typeof obj === 'object') {
        return Object.entries(obj)
            .filter(([_, v]) => v !== null && v !== undefined && v !== false)
            .map(([k, v]) => {
                if (typeof v === 'object' && !Array.isArray(v)) {
                    return `${spaces}${k}:\n${toYAML(v, indent + 2)}`;
                }
                return `${spaces}${k}: ${toYAML(v, indent + 2)}`;
            })
            .join('\n');
    }
    
    return String(obj);
}

const tree = (${getAccessibilityTree.toString()})();
console.log('Accessibility Tree (YAML):\n' + toYAML(tree));