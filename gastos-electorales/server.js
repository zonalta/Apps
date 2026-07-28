/* Servidor estático mínimo para Cloud Run.
   Sin dependencias: la aplicación es un único HTML autocontenido, así que todo
   lo que hace falta es entregarlo con las cabeceras correctas. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = process.env.PORT || 8080;
const RAIZ = path.join(__dirname, 'dist');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* La página es autocontenida: no carga nada de fuera ni llama a ningún servidor.
   La política lo refleja, de modo que si algún día se colase una referencia
   externa el navegador la bloquearía en vez de cargarla en silencio. */
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

function cabeceras(rutaFichero) {
  const ext = path.extname(rutaFichero).toLowerCase();
  return {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    /* El HTML no se cachea para que un despliegue nuevo se vea al recargar. */
    'Cache-Control': ext === '.html'
      ? 'no-cache, must-revalidate'
      : 'public, max-age=3600',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  };
}

const servidor = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Método no permitido');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  /* Sonda de vida para Cloud Run y para comprobar despliegues. */
  if (url.pathname === '/_salud') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ estado: 'ok', version: process.env.K_REVISION || 'local' }));
    return;
  }

  let relativa = decodeURIComponent(url.pathname);
  if (relativa === '/' || relativa === '') { relativa = '/index.html'; }

  const destino = path.join(RAIZ, relativa);

  /* Nada fuera de dist/, pase lo que pase con la ruta pedida. */
  if (!destino.startsWith(RAIZ + path.sep) && destino !== path.join(RAIZ, 'index.html')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Prohibido');
    return;
  }

  fs.readFile(destino, (err, contenido) => {
    if (err) {
      /* Una sola página: cualquier ruta desconocida devuelve la aplicación. */
      fs.readFile(path.join(RAIZ, 'index.html'), (err2, indice) => {
        if (err2) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('La aplicación no está compilada. Ejecute: node build.js');
          return;
        }
        res.writeHead(200, cabeceras('index.html'));
        res.end(req.method === 'HEAD' ? undefined : indice);
      });
      return;
    }
    res.writeHead(200, cabeceras(destino));
    res.end(req.method === 'HEAD' ? undefined : contenido);
  });
});

servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Gestión Electoral escuchando en el puerto ${PUERTO}`);
});

/* Cloud Run envía SIGTERM al retirar una instancia. */
process.on('SIGTERM', () => {
  servidor.close(() => process.exit(0));
});
