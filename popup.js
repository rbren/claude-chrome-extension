document.addEventListener('DOMContentLoaded', function() {
    const litellmKeyInput = document.getElementById('litellmKey');
    const litellmUrlInput = document.getElementById('litellmUrl');
    const litellmModelInput = document.getElementById('litellmModel');

    // Load saved values
    chrome.storage.local.get(['litellmKey', 'litellmUrl', 'litellmModel'], function(result) {
        if (result.litellmKey) litellmKeyInput.value = result.litellmKey;
        if (result.litellmUrl) litellmUrlInput.value = result.litellmUrl;
        if (result.litellmModel) litellmModelInput.value = result.litellmModel;
    });

    // Save values when they change
    litellmKeyInput.addEventListener('change', function() {
        chrome.storage.local.set({ litellmKey: litellmKeyInput.value });
    });

    litellmUrlInput.addEventListener('change', function() {
        chrome.storage.local.set({ litellmUrl: litellmUrlInput.value });
    });

    litellmModelInput.addEventListener('change', function() {
        chrome.storage.local.set({ litellmModel: litellmModelInput.value });
    });
});