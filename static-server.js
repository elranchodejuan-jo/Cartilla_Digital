const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.FRONTEND_PORT || 5500;
const ROOT = path.resolve(__dirname);

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

function responder(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const rutaSolicitada = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
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

server.listen(PORT, () => {
    console.log(`Frontend disponible en http://localhost:${PORT}`);
});
