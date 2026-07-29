/* Servidor de Gestión Electoral para Cloud Run.
   Sirve la aplicación y la API de datos. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { crearAlmacen } = require('./servidor/almacen');
const { crearApi } = require('./servidor/api');
const autenticacion = require('./servidor/autenticacion');

const PUERTO = process.env.PORT || 8080;
const RAIZ = path.join(__dirname, 'dist');

const almacen = crearAlmacen();
const api = crearApi(almacen);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* La página no carga nada de fuera salvo el botón de acceso de Google, que
   necesita su script y su iframe. Todo lo demás sigue bloqueado, de modo que
   cualquier referencia externa que se colase por error no llegaría a cargarse. */
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "frame-src https://accounts.google.com/gsi/",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

function cabeceras(rutaFichero) {
  const ext = path.extname(rutaFichero).toLowerCase();
  return {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    /* El HTML no se cachea para que un despliegue nuevo se vea al recargar. */
    'Cache-Control': ext === '.html' ? 'no-cache, must-revalidate' : 'public, max-age=3600',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  };
}

function servirEstatico(req, res, url) {
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
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  /* Sonda de vida para Cloud Run. No revela nada del estado de los datos. */
  if (url.pathname === '/_salud') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      estado: 'ok',
      version: process.env.K_REVISION || 'local',
      commit: process.env.GIT_SHA ? process.env.GIT_SHA.slice(0, 7) : null,
      almacen: almacen.tipo,
      autenticacion: autenticacion.configurado() ? 'configurada' : 'sin configurar'
    }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (await api(req, res, url)) { return; }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Método no permitido');
    return;
  }

  servirEstatico(req, res, url);
});

servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Gestión Electoral escuchando en el puerto ${PUERTO}`);
  console.log(`  almacén: ${almacen.tipo}`);
  console.log(`  autenticación: ${autenticacion.configurado() ? 'configurada' : 'SIN CONFIGURAR'}`);
});

/* Cloud Run envía SIGTERM al retirar una instancia. */
process.on('SIGTERM', () => {
  servidor.close(() => process.exit(0));
});
