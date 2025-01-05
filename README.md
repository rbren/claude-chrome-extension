# Claude Chrome Extension

A Chrome extension that allows you to send text to Claude AI and execute the returned JavaScript on any webpage.

## Installation Instructions

1. Download this repository (Code > Download ZIP) and unzip it, or clone it:
   ```bash
   git clone https://github.com/rbren/claude-chrome-extension.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in your Chrome toolbar

2. Enter your Claude API key (you only need to do this once)

3. Type your instructions in the text box

4. Click "Generate and Execute JavaScript"

The extension will send your instructions to Claude, receive JavaScript code in response, and execute it on the current webpage.