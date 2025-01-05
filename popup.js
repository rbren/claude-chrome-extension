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

    executeButton.disabled = true;
    executeButton.textContent = 'Processing...';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: `Generate JavaScript code for the following task. Only provide the code, no explanations: ${prompt}`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const generatedCode = data.content[0].text;

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Execute the generated code in the active tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          try {
            return eval(code);
          } catch (error) {
            console.error('Execution error:', error);
            return error.toString();
          }
        },
        args: [generatedCode]
      });

      executeButton.textContent = 'Success!';
      setTimeout(() => {
        executeButton.disabled = false;
        executeButton.textContent = 'Generate and Execute JavaScript';
      }, 2000);

    } catch (error) {
      console.error('Error:', error);
      executeButton.textContent = 'Error! Check console';
      executeButton.style.backgroundColor = '#ff4444';
      setTimeout(() => {
        executeButton.disabled = false;
        executeButton.textContent = 'Generate and Execute JavaScript';
        executeButton.style.backgroundColor = '';
      }, 3000);
    }
  });
});