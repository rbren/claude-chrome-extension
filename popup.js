function getCurrentTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        callback(tabs[0]);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    const litellmKeyInput = document.getElementById('litellmKey');
    const litellmUrlInput = document.getElementById('litellmUrl');
    const litellmModelInput = document.getElementById('litellmModel');
    const userInput = document.getElementById('userInput');
    const executeButton = document.getElementById('executeButton');
    
    console.log('Found elements:', {
        key: !!litellmKeyInput,
        url: !!litellmUrlInput,
        model: !!litellmModelInput,
        input: !!userInput,
        button: !!executeButton
    });

    // Load saved values
    chrome.storage.local.get(['litellmKey', 'litellmUrl', 'litellmModel'], function(result) {
        console.log('Loaded stored values:', result);
        if (result.litellmKey) litellmKeyInput.value = result.litellmKey;
        if (result.litellmUrl) litellmUrlInput.value = result.litellmUrl;
        if (result.litellmModel) litellmModelInput.value = result.litellmModel;
    });

    executeButton.onclick = function() {
        console.log('Button clicked!');
        
        const litellmKey = litellmKeyInput.value;
        const litellmUrl = litellmUrlInput.value;
        const litellmModel = litellmModelInput.value;
        const prompt = userInput.value;

        console.log('Input values:', {
            keyLength: litellmKey?.length,
            url: litellmUrl,
            model: litellmModel,
            promptLength: prompt?.length
        });

        if (!litellmKey || !litellmUrl || !litellmModel || !prompt) {
            alert('Please fill in all fields');
            return;
        }

        executeButton.disabled = true;
        executeButton.textContent = 'Processing...';

        getCurrentTab(function(tab) {
            console.log('Current tab:', tab);
            
            // First send a test message to the content script
            chrome.tabs.sendMessage(tab.id, { 
                action: 'log',
                message: '🎯 Starting request processing'
            }, function(response) {
                console.log('Got response from content script:', response);
                if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    alert('Error: ' + chrome.runtime.lastError.message);
                    executeButton.disabled = false;
                    executeButton.textContent = 'Generate and Execute JavaScript';
                    return;
                }

                // If we got here, messaging works, proceed with the API call
                const apiUrl = litellmUrl + '/v1/chat/completions';
                const requestBody = {
                    model: litellmModel,
                    messages: [{
                        role: 'user',
                        content: `Generate JavaScript code for the following task. Only provide the code, no explanations: ${prompt}`
                    }]
                };
                
                console.log('Making API request to:', apiUrl);
                console.log('Request body:', requestBody);
                console.log('Request headers:', {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + litellmKey.substring(0, 4) + '...'
                });

                fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${litellmKey}`
                    },
                    body: JSON.stringify(requestBody)
                })
                .then(response => {
                    console.log('Got response:', {
                        status: response.status,
                        ok: response.ok,
                        statusText: response.statusText
                    });
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error(`HTTP ${response.status}: ${text}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('API response:', data);
                    const code = data.choices[0].message.content;
                    
                    // Send code to content script
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'executeCode',
                        code: code
                    }, function(execResponse) {
                        console.log('Code execution response:', execResponse);
                        executeButton.textContent = 'Success!';
                        setTimeout(() => {
                            executeButton.disabled = false;
                            executeButton.textContent = 'Generate and Execute JavaScript';
                        }, 2000);
                    });
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error: ' + error.message);
                    executeButton.disabled = false;
                    executeButton.textContent = 'Generate and Execute JavaScript';
                });
            });
        });
    };
});