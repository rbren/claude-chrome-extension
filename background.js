chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateAndExecuteCode') {
    handleClaudeRequest(request.apiKey, request.prompt);
  }
});

async function handleClaudeRequest(apiKey, prompt) {
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
  } catch (error) {
    console.error('Error:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Error',
      message: error.toString()
    });
  }
}