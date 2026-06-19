const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.FRONTEND_PORT || 5500;
const BACKEND_PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);
const BACKEND_URL = `http://localhost:${BACKEND_PORT}/api/health`;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.ico': 'image/x-icon'
};

let backendProcess = null;

function crearEntornoLimpio() {
    if (process.platform !== 'win32') return process.env;
    const env = {};
    const vistos = new Set();
    Object.keys(process.env).forEach(key => {
        const normalizada = key.toUpperCase();
        if (vistos.has(normalizada)) return;
        vistos.add(normalizada);
        env[key] = process.env[key];
    });
    return env;
}

function apiDisponible(timeoutMs = 1200) {
    return new Promise(resolve => {
        const req = http.get(BACKEND_URL, res => {
            res.resume();
            resolve(res.statusCode === 200 || res.statusCode === 503);
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
        req.on('error', () => resolve(false));
    });
}

async function asegurarBackendLocal() {
    if (process.env.CARTILLA_SKIP_BACKEND_AUTOSTART === '1') return;
    if (await apiDisponible()) return;

    const serverDir = path.join(ROOT, 'server');
    console.log(`API no detectada en http://localhost:${BACKEND_PORT}. Iniciando backend local...`);
    backendProcess = spawn(process.execPath, ['index.js'], {
        cwd: serverDir,
        env: crearEntornoLimpio(),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    backendProcess.stdout.on('data', data => process.stdout.write(`[api] ${data}`));
    backendProcess.stderr.on('data', data => process.stderr.write(`[api] ${data}`));
    backendProcess.on('error', err => {
        console.error(`No se pudo iniciar el backend local: ${err.message}`);
    });
    backendProcess.on('exit', code => {
        if (code !== 0 && code !== null) {
            console.error(`El backend local se detuvo con codigo ${code}.`);
        }
        backendProcess = null;
    });

    const limite = Date.now() + 9000;
    while (Date.now() < limite) {
        if (await apiDisponible(700)) return;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.warn(`No se pudo confirmar la API en http://localhost:${BACKEND_PORT}. Revisa la salida marcada como [api].`);
}

function responder(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.end(body);
}

function responderJson(res, status, body) {
    responder(res, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

async function proxyApiRequest(req, res, url) {
    await asegurarBackendLocal();

    const options = {
        hostname: 'localhost',
        port: BACKEND_PORT,
        path: `${url.pathname}${url.search}`,
        method: req.method,
        headers: {
            ...req.headers,
            host: `localhost:${BACKEND_PORT}`
        }
    };

    const proxyReq = http.request(options, proxyRes => {
        const headers = { ...proxyRes.headers };
        delete headers['transfer-encoding'];
        res.writeHead(proxyRes.statusCode || 502, headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
        responderJson(res, 502, {
            error: `No se pudo conectar con la API local en http://localhost:${BACKEND_PORT}.`,
            detalle: err.message
        });
    });

    req.pipe(proxyReq);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let rutaSolicitada = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    if (rutaSolicitada === '/admin' || rutaSolicitada === '/admin/') {
        rutaSolicitada = '/admin.html';
    }

    if (rutaSolicitada === '/api' || rutaSolicitada.startsWith('/api/')) {
        proxyApiRequest(req, res, url).catch(err => {
            responderJson(res, 500, { error: 'Error al preparar la API local.', detalle: err.message });
        });
        return;
    }

    const rutaArchivo = path.resolve(ROOT, `.${rutaSolicitada}`);

    if (rutaArchivo !== ROOT && !rutaArchivo.startsWith(`${ROOT}${path.sep}`)) {
        responder(res, 403, 'Forbidden');
        return;
    }

    fs.readFile(rutaArchivo, (err, data) => {
        if (err) {
            responder(res, 404, 'Not found');
            return;
        }

        const ext = path.extname(rutaArchivo).toLowerCase();
        responder(res, 200, data, MIME_TYPES[ext] || 'application/octet-stream');
    });
});

process.on('exit', () => {
    if (backendProcess && !backendProcess.killed) backendProcess.kill();
});

asegurarBackendLocal().finally(() => {
    server.listen(PORT, () => {
        console.log(`Frontend disponible en http://localhost:${PORT}`);
    });
});
