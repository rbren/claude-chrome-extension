document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    const button = document.getElementById('executeButton');
    console.log('Found button:', button);
    
    if (button) {
        button.onclick = function() {
            console.log('Button clicked!');
            alert('Button clicked!');
        };
    } else {
        console.error('Button not found');
    }

    // Test that console.log works
    setInterval(() => {
        console.log('Heartbeat:', new Date().toISOString());
    }, 1000);
    
}));