document.addEventListener('DOMContentLoaded', function() {
  console.log('🟢 Popup loaded');
  
  const apiKeyInput = document.getElementById('apiKey');
  const userInput = document.getElementById('userInput');
  const executeButton = document.getElementById('executeButton');
  
  console.log('🟢 DOM elements found:', { 
    apiKeyInput: !!apiKeyInput, 
    userInput: !!userInput, 
    executeButton: !!executeButton 
  });

  // Load saved API key
  chrome.storage.local.get(['claudeApiKey'], function(result) {
    console.log('🟢 Loaded API key from storage:', result.claudeApiKey ? '(exists)' : '(none)');
    if (result.claudeApiKey) {
      apiKeyInput.value = result.claudeApiKey;
    }
  });

  // Save API key when changed
  apiKeyInput.addEventListener('change', function() {
    console.log('🟢 Saving new API key to storage');
    chrome.storage.local.set({ claudeApiKey: apiKeyInput.value });
  });

  executeButton.addEventListener('click', async function() {
    console.log('🟢 Execute button clicked');
    
    const apiKey = apiKeyInput.value;
    const prompt = userInput.value;
    console.log('🟢 Input values:', { 
      apiKeyExists: !!apiKey, 
      promptLength: prompt?.length,
      prompt: prompt 
    });

    if (!apiKey || !prompt) {
      console.log('🔴 Missing required inputs');
      alert('Please provide both API key and instructions');
      return;
    }

    executeButton.disabled = true;
    executeButton.textContent = 'Processing...';
    console.log('🟢 Button disabled and set to Processing...');

    try {
      console.log('🟢 Preparing API request to Claude');
      const requestBody = {
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Generate JavaScript code for the following task. Only provide the code, no explanations: ${prompt}`
        }]
      };
      console.log('🟢 Request body:', requestBody);

      console.log('🟢 Sending fetch request to Claude API...');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });
      console.log('🟢 Received response:', { 
        status: response.status, 
        ok: response.ok 
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔴 Response not OK. Error text:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      console.log('🟢 Parsing response JSON');
      const data = await response.json();
      console.log('🟢 Claude response data:', data);
      
      const generatedCode = data.content[0].text;
      console.log('🟢 Generated code:', generatedCode);

      console.log('🟢 Getting active tab');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('🟢 Active tab:', tab);

      console.log('🟢 Sending code to content script');
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'executeCode',
            code: generatedCode
          }, response => {
            console.log('🟢 Got response from content script:', response);
            if (chrome.runtime.lastError) {
              console.error('🔴 Chrome runtime error:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
        console.log('🟢 Content script execution result:', result);
      } catch (error) {
        console.error('🔴 Error sending message to content script:', error);
        throw error;
      }

      executeButton.textContent = 'Success!';
      console.log('🟢 Set button to Success');
      
      setTimeout(() => {
        executeButton.disabled = false;
        executeButton.textContent = 'Generate and Execute JavaScript';
        console.log('🟢 Reset button state');
      }, 2000);

    } catch (error) {
      console.error('🔴 Top-level error:', error);
      executeButton.textContent = 'Error! Check console';
      executeButton.style.backgroundColor = '#ff4444';
      
      setTimeout(() => {
        executeButton.disabled = false;
        executeButton.textContent = 'Generate and Execute JavaScript';
        executeButton.style.backgroundColor = '';
        console.log('🟢 Reset button after error');
      }, 3000);
    }
  });
  
  console.log('🟢 Popup initialization complete');
});