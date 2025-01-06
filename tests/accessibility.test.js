// Import functions from accessibility.js
const {
  shouldIncludeNode,
  isSimpleContainer,
  getAccessibleProperties,
  getDirectTextContent,
  findRepetitiveStructure,
  truncateRepetitiveStructures,
  buildAccessibilityTree
} = require('../accessibility.js');

describe('Accessibility Tree Functions', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('shouldIncludeNode', () => {
    test('should include regular visible elements', () => {
      const div = document.createElement('div');
      div.textContent = 'Test content';
      container.appendChild(div);
      
      expect(shouldIncludeNode(div)).toBe(true);
    });

    test('should exclude script and style tags', () => {
      const script = document.createElement('script');
      const style = document.createElement('style');
      
      expect(shouldIncludeNode(script)).toBe(false);
      expect(shouldIncludeNode(style)).toBe(false);
    });

    test('should include elements with ARIA attributes even if hidden', () => {
      const div = document.createElement('div');
      div.style.display = 'none';
      div.setAttribute('aria-label', 'Hidden but important');
      container.appendChild(div);
      
      expect(shouldIncludeNode(div)).toBe(true);
    });

    test('should exclude empty text nodes', () => {
      const textNode = document.createTextNode('   ');
      expect(shouldIncludeNode(textNode)).toBe(false);
    });

    test('should include non-empty text nodes', () => {
      const textNode = document.createTextNode('Hello world');
      expect(shouldIncludeNode(textNode)).toBe(true);
    });
  });

  describe('isSimpleContainer', () => {
    test('should identify semantic elements as non-simple containers', () => {
      const nav = document.createElement('nav');
      const article = document.createElement('article');
      const header = document.createElement('header');
      
      expect(isSimpleContainer(nav)).toBe(false);
      expect(isSimpleContainer(article)).toBe(false);
      expect(isSimpleContainer(header)).toBe(false);
    });

    test('should identify elements with ARIA attributes as non-simple containers', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'navigation');
      
      const span = document.createElement('span');
      span.setAttribute('aria-label', 'Menu');
      
      expect(isSimpleContainer(div)).toBe(false);
      expect(isSimpleContainer(span)).toBe(false);
    });

    test('should identify basic wrapper divs as simple containers', () => {
      const div = document.createElement('div');
      div.className = 'wrapper';
      div.id = 'container';
      
      expect(isSimpleContainer(div)).toBe(true);
    });

    test('should not treat elements with direct text as simple containers', () => {
      const div = document.createElement('div');
      div.textContent = 'Direct content';
      
      expect(isSimpleContainer(div)).toBe(false);
    });
  });

  describe('truncateRepetitiveStructures', () => {
    test('should truncate repeated elements', () => {
      const items = Array(10).fill(null).map(() => ({
        type: 'element',
        tagName: 'div',
        children: [{ type: 'text', content: 'Item' }]
      }));
      
      const result = truncateRepetitiveStructures(items);
      expect(result.length).toBe(7); // 3 shown at start + 1 truncation message + 3 shown at end
      expect(result.some(item => item.content && item.content.includes('more similar'))).toBe(true);
    });

    test('should not truncate diverse elements', () => {
      const items = [
        { type: 'element', tagName: 'div', children: [{ type: 'text', content: 'First' }] },
        { type: 'element', tagName: 'span', children: [{ type: 'text', content: 'Second' }] },
        { type: 'element', tagName: 'p', children: [{ type: 'text', content: 'Third' }] }
      ];
      
      const result = truncateRepetitiveStructures(items);
      expect(result).toEqual(items);
    });
  });
});