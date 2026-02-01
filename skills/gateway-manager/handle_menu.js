const { execSync } = require('child_process');

// Read payload from stdin
let payload = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
    payload += chunk;
});

process.stdin.on('end', () => {
    try {
        if (!payload.trim()) {
            console.log('No payload received');
            return;
        }
        const data = JSON.parse(payload);
        
        // Handle Feishu Event Structure
        // Payload usually comes as the 'event' object or wrapped in { header, event }
        // We look for 'event_key' inside 'event'
        
        const eventData = data.event || data;
        const eventKey = eventData.event_key;

        console.log(`[MenuHandler] Processing event_key: ${eventKey}`);

        if (eventKey === 'restart_gateway') {
            console.log('🚀 RESTART COMMAND VERIFIED. INITIATING RESTART...');
            
            // Optional: Send a "Restarting..." message if we have a chat_id (omitted for safety/speed)
            
            try {
                execSync('openclaw gateway restart', { stdio: 'inherit' });
            } catch (err) {
                console.error('Failed to restart gateway:', err.message);
            }
        } else {
            console.log(`[MenuHandler] Ignored event_key: ${eventKey}`);
        }
    } catch (e) {
        console.error('[MenuHandler] Error:', e.message);
    }
});
