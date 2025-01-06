const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const yaml = require('js-yaml');
const { buildAccessibilityTree } = require('../accessibility.js');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const HTML_DIR = path.join(FIXTURES_DIR, 'html');
const SNAPSHOT_DIR = path.join(FIXTURES_DIR, 'snapshots');

// Ensure snapshot directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

describe('Accessibility Tree Snapshots', () => {
    // Get all HTML files from the fixtures directory
    const htmlFiles = fs.readdirSync(HTML_DIR)
        .filter(file => file.endsWith('.html'));

    htmlFiles.forEach(htmlFile => {
        const testName = path.basename(htmlFile, '.html');
        const htmlPath = path.join(HTML_DIR, htmlFile);
        const snapshotPath = path.join(SNAPSHOT_DIR, `${testName}.yaml`);

        test(`generates correct accessibility tree for ${testName}`, () => {
            // Read and parse the HTML file
            const html = fs.readFileSync(htmlPath, 'utf8');
            const dom = new JSDOM(html);
            global.document = dom.window.document;
            global.window = dom.window;
            global.getComputedStyle = dom.window.getComputedStyle;
            global.Node = dom.window.Node;

            // Generate the accessibility tree
            const tree = buildAccessibilityTree(dom.window.document.body);
            const yamlOutput = yaml.dump(tree, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                sortKeys: true
            });

            // If snapshot doesn't exist, create it
            if (!fs.existsSync(snapshotPath)) {
                fs.writeFileSync(snapshotPath, yamlOutput, 'utf8');
                console.log(`Created new snapshot for ${testName}`);
                return;
            }

            // Read existing snapshot
            const existingSnapshot = fs.readFileSync(snapshotPath, 'utf8');

            // Compare with existing snapshot
            expect(yamlOutput).toBe(existingSnapshot);
        });
    });
});