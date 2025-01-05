async function sendLog(tabId, message, type = 'info') {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'log',
      message,
      type
    });
  } catch (error) {
    console.error('Failed to send log:', error);
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const apiKeyInput = document.getElementById('apiKey');
  const userInput = document.getElementById('userInput');
  const executeButton = document.getElementById('executeButton');
  
  // Get active tab for logging
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendLog(tab.id, '🟢 Popup opened');
  
  if (apiKeyInput && userInput && executeButton) {
    await sendLog(tab.id, '🟢 DOM elements initialized');
  } else {
    await sendLog(tab.id, '🔴 Failed to find DOM elements', 'error');
    return;
  }

  // Load saved API key
  chrome.storage.local.get(['claudeApiKey'], async function(result) {
    await sendLog(tab.id, '🔑 API key from storage: ' + (result.claudeApiKey ? '(exists)' : '(none)'));
    if (result.claudeApiKey) {
      apiKeyInput.value = result.claudeApiKey;
    }
  });

  // Save API key when changed
  apiKeyInput.addEventListener('change', async function() {
    await sendLog(tab.id, '💾 Saving new API key to storage');
    chrome.storage.local.set({ claudeApiKey: apiKeyInput.value });
  });

  executeButton.addEventListener('click', async function() {
    await sendLog(tab.id, '🔵 Execute button clicked');
    
    const apiKey = apiKeyInput.value;
    const prompt = userInput.value;
    await sendLog(tab.id, `📝 Prompt length: ${prompt?.length || 0} characters`);

    if (!apiKey || !prompt) {
      await sendLog(tab.id, '🔴 Missing API key or prompt', 'error');
      alert('Please provide both API key and instructions');
      return;
    }

    executeButton.disabled = true;
    executeButton.textContent = 'Processing...';
    await sendLog(tab.id, '⏳ Processing request...');

    try {
      await sendLog(tab.id, '🎯 Preparing Claude API request');
      const requestBody = {
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Generate JavaScript code for the following task. Only provide the code, no explanations: ${prompt}`
        }]
      };

      await sendLog(tab.id, '🌐 Sending request to Claude API...');

      let response;
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });
      } catch (networkError) {
        const errorMsg = `Network error: ${networkError.message}`;
        await sendLog(tab.id, '❌ ' + errorMsg, 'error');
        throw networkError;
      }

      await sendLog(tab.id, `📡 Response status: ${response.status} (${response.ok ? 'OK' : 'Error'})`);

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `HTTP error! status: ${response.status}, body: ${errorText}`;
        await sendLog(tab.id, '❌ ' + errorMsg, 'error');
        throw new Error(errorMsg);
      }

      await sendLog(tab.id, '✅ Received response from Claude API');

      let data;
      try {
        await sendLog(tab.id, '🔍 Parsing JSON response...');
        data = await response.json();
      } catch (jsonError) {
        const errorMsg = `Failed to parse JSON response: ${jsonError.message}`;
        await sendLog(tab.id, '❌ ' + errorMsg, 'error');
        throw jsonError;
      }

      const generatedCode = data.content[0].text;
      await sendLog(tab.id, '📝 Generated code from Claude response');
      await sendLog(tab.id, '⚡ Sending code to content script for execution');

      try {
        const result = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'executeCode',
            code: generatedCode
          }, response => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
        await sendLog(tab.id, '✨ Code execution complete');
      } catch (error) {
        await sendLog(tab.id, '❌ Failed to execute code: ' + error.message, 'error');
        throw error;
      }

      executeButton.textContent = 'Success!';
      await sendLog(tab.id, '🎉 Operation completed successfully');
      
      setTimeout(async () => {
        executeButton.disabled = false;
        executeButton.textContent = 'Generate and Execute JavaScript';
        await sendLog(tab.id, '🔄 Ready for next request');
      }, 2000);

    } catch (error) {
      await sendLog(tab.id, '💥 Operation failed: ' + error.message, 'error');
      executeButton.textContent = 'Error! Check logs';
      executeButton.style.backgroundColor = '#ff4444';
      
      setTimeout(async () => {
        executeButton.disabled = false;
        executeButton.textContent = 'Generate and Execute JavaScript';
        executeButton.style.backgroundColor = '';
        await sendLog(tab.id, '🔄 Ready to try again');
      }, 3000);
    }
  });
  
  await sendLog(tab.id, '✅ Popup initialization complete');
});