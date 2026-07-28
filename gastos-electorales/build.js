#!/usr/bin/env node
/* Empaqueta src/ en un único HTML autocontenido.
   Sin dependencias externas: el resultado funciona abierto desde el disco,
   servido por el backend, o publicado como página estática. */
const fs = require('fs');
const path = require('path');

const raiz = __dirname;
const src = path.join(raiz, 'src');
const salida = path.join(raiz, 'dist');

const estilos = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');

const ficherosJs = fs.readdirSync(path.join(src, 'js'))
  .filter((f) => f.endsWith('.js'))
  .sort(); // el prefijo numérico fija el orden de carga

const guion = ficherosJs
  .map((f) => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(src, 'js', f), 'utf8'))
  .join('\n');

const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
  .replace('/*__ESTILOS__*/', () => estilos)
  .replace('/*__GUION__*/', () => guion);

fs.mkdirSync(salida, { recursive: true });
fs.writeFileSync(path.join(salida, 'index.html'), html);

/* Variante para publicar como vista previa: el mismo contenido sin el envoltorio
   <html>/<head>/<body>, que en ese destino lo pone la propia plataforma. */
const fragmento = [
  '<title>Gestión Electoral — Gastos de colaboradores</title>',
  `<style>\n${estilos}\n</style>`,
  '<div id="app" class="app"></div>',
  `<script>\n${guion}\n</script>`
].join('\n');
fs.writeFileSync(path.join(salida, 'vista-previa.html'), fragmento);

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`dist/index.html generado — ${kb} KB (${ficherosJs.length} módulos)`);
console.log('dist/vista-previa.html generado');
