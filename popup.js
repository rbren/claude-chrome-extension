document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const userInput = document.getElementById('userInput');
  const executeButton = document.getElementById('executeButton');

  // Load saved API key
  chrome.storage.local.get(['claudeApiKey'], function(result) {
    if (result.claudeApiKey) {
      apiKeyInput.value = result.claudeApiKey;
    }
  });

  // Save API key when changed
  apiKeyInput.addEventListener('change', function() {
    chrome.storage.local.set({ claudeApiKey: apiKeyInput.value });
  });

  executeButton.addEventListener('click', async function() {
    const apiKey = apiKeyInput.value;
    const prompt = userInput.value;

    if (!apiKey || !prompt) {
      alert('Please provide both API key and instructions');
      return;
    }

    try {
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'generateAndExecuteCode',
        apiKey: apiKey,
        prompt: prompt
      });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
});