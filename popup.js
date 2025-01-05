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
  const litellmKeyInput = document.getElementById('litellmKey');
  const litellmUrlInput = document.getElementById('litellmUrl');
  const litellmModelInput = document.getElementById('litellmModel');
  const userInput = document.getElementById('userInput');
  const executeButton = document.getElementById('executeButton');
  
  // Get active tab for logging
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendLog(tab.id, '🟢 Popup opened');
  
  if (litellmKeyInput && litellmUrlInput && litellmModelInput && userInput && executeButton) {
    await sendLog(tab.id, '🟢 DOM elements initialized');
  } else {
    await sendLog(tab.id, '🔴 Failed to find DOM elements', 'error');
    return;
  }

  // Load saved values
  chrome.storage.local.get(['litellmKey', 'litellmUrl', 'litellmModel'], async function(result) {
    await sendLog(tab.id, '🔑 Loading saved settings...');
    if (result.litellmKey) {
      litellmKeyInput.value = result.litellmKey;
    }
    if (result.litellmUrl) {
      litellmUrlInput.value = result.litellmUrl;
    }
    if (result.litellmModel) {
      litellmModelInput.value = result.litellmModel;
    }
  });

  // Save settings when changed
  litellmKeyInput.addEventListener('change', async function() {
    await sendLog(tab.id, '💾 Saving new API key');
    chrome.storage.local.set({ litellmKey: litellmKeyInput.value });
  });

  litellmUrlInput.addEventListener('change', async function() {
    await sendLog(tab.id, '💾 Saving new URL');
    chrome.storage.local.set({ litellmUrl: litellmUrlInput.value });
  });

  litellmModelInput.addEventListener('change', async function() {
    await sendLog(tab.id, '💾 Saving new model');
    chrome.storage.local.set({ litellmModel: litellmModelInput.value });
  });

  executeButton.addEventListener('click', async function() {
    await sendLog(tab.id, '🔵 Execute button clicked');
    
    const litellmKey = litellmKeyInput.value;
    const litellmUrl = litellmUrlInput.value;
    const litellmModel = litellmModelInput.value;
    const prompt = userInput.value;
    await sendLog(tab.id, `📝 Prompt length: ${prompt?.length || 0} characters`);

    if (!litellmKey || !litellmUrl || !litellmModel || !prompt) {
      await sendLog(tab.id, '🔴 Missing required fields', 'error');
      alert('Please provide all required fields');
      return;
    }

    executeButton.disabled = true;
    executeButton.textContent = 'Processing...';
    await sendLog(tab.id, '⏳ Processing request...');

    try {
      await sendLog(tab.id, '🎯 Preparing LiteLLM request');
      const requestBody = {
        model: litellmModel,
        messages: [{
          role: 'user',
          content: `Generate JavaScript code for the following task. Only provide the code, no explanations: ${prompt}`
        }]
      };

      await sendLog(tab.id, '🌐 Sending request to LiteLLM...');

      let response;
      try {
        response = await fetch(litellmUrl + '/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${litellmKey}`
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

      const generatedCode = data.choices[0].message.content;
      await sendLog(tab.id, '📝 Generated code from Claude response');
      await sendLog(tab.id, '⚡ Sending code to content script for execution');

      try {
        await sendLog(tab.id, '⚡ Executing code via chrome.scripting.executeScript');
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (code) => {
            return eval(code);
          },
          args: [generatedCode]
        });
        const result = results[0].result;
        await sendLog(tab.id, '✨ Code execution complete. Result: ' + JSON.stringify(result));
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