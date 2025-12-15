// Prosta funkcja testowa - sprawdź czy Netlify wykrywa funkcje
exports.handler = async function(event, context) {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: 'Netlify Functions are working!',
            timestamp: new Date().toISOString(),
            path: event.path
        })
    };
};

