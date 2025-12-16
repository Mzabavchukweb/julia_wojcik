// Lokalny serwer testowy do webhooka
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import funkcji webhooka
const webhookHandler = (await import('./api/stripe-webhook.js')).default;

const PORT = 3000;

// Emuluj request Vercel
function createVercelRequest(req, body) {
    return {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: new URL(req.url, `http://${req.headers.host}`).searchParams,
        body: body
    };
}

// Emuluj response Vercel
function createVercelResponse(res) {
    let statusCode = 200;
    let headers = {};
    let body = '';
    
    return {
        status: (code) => {
            statusCode = code;
            return this;
        },
        json: (data) => {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(data);
            return this;
        },
        send: (data) => {
            body = data;
            return this;
        },
        setHeader: (name, value) => {
            headers[name] = value;
            return this;
        },
        getHeader: (name) => headers[name],
        end: () => {
            res.writeHead(statusCode, headers);
            res.end(body);
        }
    };
}

const server = http.createServer(async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📥 [${requestId}] [${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Test-Event, Stripe-Signature');
    
    if (req.method === 'OPTIONS') {
        console.log(`[${requestId}] ✅ OPTIONS request - CORS preflight`);
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Obsługa API routes
    if (req.url.startsWith('/api/')) {
        let body = '';
        let bodyLength = 0;
        
        req.on('data', chunk => {
            body += chunk.toString();
            bodyLength += chunk.length;
            console.log(`[${requestId}] 📦 Received ${chunk.length} bytes (total: ${bodyLength})`);
        });
        
        req.on('end', async () => {
            try {
                console.log(`[${requestId}] 📥 Request body received (${bodyLength} bytes)`);
                console.log(`[${requestId}] Body type:`, typeof body);
                console.log(`[${requestId}] Body preview:`, body.substring(0, 200));
                
                // Parsuj body jeśli to JSON
                let parsedBody = body;
                try {
                    if (body && body.trim().startsWith('{')) {
                        parsedBody = JSON.parse(body);
                        console.log(`[${requestId}] ✅ Body parsed as JSON`);
                    } else {
                        console.log(`[${requestId}] ℹ️ Body kept as string (not JSON)`);
                    }
                } catch (e) {
                    console.log(`[${requestId}] ⚠️ Could not parse as JSON, keeping as string:`, e.message);
                    parsedBody = body;
                }
                
                console.log(`[${requestId}] 🔄 Calling webhook handler...`);
                const vercelReq = createVercelRequest(req, parsedBody);
                const vercelRes = createVercelResponse(res);
                
                await webhookHandler(vercelReq, vercelRes);
                
                const duration = Date.now() - startTime;
                console.log(`[${requestId}] ✅ Handler completed in ${duration}ms`);
                
                if (!vercelRes.headersSent) {
                    vercelRes.end();
                }
            } catch (error) {
                const duration = Date.now() - startTime;
                console.error(`\n${'='.repeat(80)}`);
                console.error(`[${requestId}] ❌❌❌ CRITICAL ERROR in handler ❌❌❌`);
                console.error(`${'='.repeat(80)}`);
                console.error(`[${requestId}] Error name:`, error.name);
                console.error(`[${requestId}] Error message:`, error.message);
                console.error(`[${requestId}] Error stack:`, error.stack);
                console.error(`[${requestId}] Error code:`, error.code || 'N/A');
                console.error(`[${requestId}] Request duration:`, duration, 'ms');
                console.error(`[${requestId}] Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                console.error(`${'='.repeat(80)}\n`);
                
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        error: error.message,
                        errorName: error.name,
                        requestId: requestId,
                        duration: duration,
                        stack: error.stack
                    }));
                }
            }
        });
        
        req.on('error', (error) => {
            console.error(`[${requestId}] ❌ Request stream error:`, error.message);
            console.error(`[${requestId}] Error stack:`, error.stack);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: error.message,
                    requestId: requestId
                }));
            }
        });
        
        req.on('aborted', () => {
            console.error(`[${requestId}] ⚠️ Request aborted by client`);
        });
    } else {
        // Serwuj pliki statyczne
        try {
            let filePath = join(__dirname, req.url === '/' ? 'index.html' : req.url);
            console.log(`[${requestId}] 📄 Serving static file:`, filePath);
            const content = readFileSync(filePath);
            res.writeHead(200);
            res.end(content);
            console.log(`[${requestId}] ✅ File served (${content.length} bytes)`);
        } catch (error) {
            console.error(`[${requestId}] ❌ File not found:`, req.url);
            console.error(`[${requestId}] Error:`, error.message);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        }
    }
});

// Obsługa błędów serwera
server.on('error', (error) => {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`❌❌❌ SERVER ERROR ❌❌❌`);
    console.error(`${'='.repeat(80)}`);
    console.error(`Error name:`, error.name);
    console.error(`Error message:`, error.message);
    console.error(`Error code:`, error.code);
    console.error(`Error stack:`, error.stack);
    console.error(`${'='.repeat(80)}\n`);
});

process.on('uncaughtException', (error) => {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`❌❌❌ UNCAUGHT EXCEPTION ❌❌❌`);
    console.error(`${'='.repeat(80)}`);
    console.error(`Error name:`, error.name);
    console.error(`Error message:`, error.message);
    console.error(`Error stack:`, error.stack);
    console.error(`${'='.repeat(80)}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`❌❌❌ UNHANDLED REJECTION ❌❌❌`);
    console.error(`${'='.repeat(80)}`);
    console.error(`Reason:`, reason);
    console.error(`Promise:`, promise);
    if (reason instanceof Error) {
        console.error(`Error name:`, reason.name);
        console.error(`Error message:`, reason.message);
        console.error(`Error stack:`, reason.stack);
    }
    console.error(`${'='.repeat(80)}\n`);
});

server.listen(PORT, () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 Lokalny serwer testowy uruchomiony!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔗 Webhook: http://localhost:${PORT}/api/stripe-webhook`);
    console.log(`📝 Wszystkie logi i błędy będą widoczne poniżej`);
    console.log(`🔍 Każdy request ma unikalny ID dla łatwego śledzenia`);
    console.log(`${'='.repeat(80)}\n`);
});

