/* API de datos. Todo lo que hay debajo de /api exige sesión válida. */
'use strict';

const autenticacion = require('./autenticacion');
const usuarios = require('./usuarios');

const LIMITE_CUERPO = 2 * 1024 * 1024; // los datos reales rondan los 30 KB

function responder(res, estado, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(texto);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    let excedido = false;

    req.on('data', (trozo) => {
      if (excedido) { return; }
      datos += trozo;
      if (datos.length > LIMITE_CUERPO) {
        excedido = true;
        const err = new Error('El cuerpo de la petición es demasiado grande.');
        err.estado = 413;
        reject(err);
        req.destroy();
      }
    });
    req.on('end', () => {
      if (excedido) { return; }
      if (!datos) { return resolve(null); }
      try { resolve(JSON.parse(datos)); }
      catch (e) {
        const err = new Error('El cuerpo no es JSON válido.');
        err.estado = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/* Sólo se aceptan las claves que la aplicación conoce. Un cliente manipulado no
   puede colar campos arbitrarios en la base de datos. */
const CLAVES = ['convocatoria', 'config', 'mesas', 'representantes', 'policia', 'cargas'];

function sanear(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    const err = new Error('Los datos enviados no tienen el formato esperado.');
    err.estado = 400;
    throw err;
  }
  const limpio = {};
  CLAVES.forEach((k) => {
    if (datos[k] !== undefined) { limpio[k] = datos[k]; }
  });
  return limpio;
}

function crearApi(almacen) {
  return async function manejar(req, res, url) {
    const ruta = url.pathname;

    /* Lo único abierto: qué hace falta para iniciar sesión. */
    if (ruta === '/api/configuracion' && req.method === 'GET') {
      responder(res, 200, autenticacion.configuracionPublica());
      return true;
    }

    if (!ruta.startsWith('/api/')) { return false; }

    let sesion;
    try {
      sesion = await autenticacion.identificar(req);
    } catch (e) {
      responder(res, e.estado || 401, { error: e.message });
      return true;
    }

    try {
      if (ruta === '/api/sesion' && req.method === 'GET') {
        responder(res, 200, sesion);
        return true;
      }

      if (ruta === '/api/estado' && req.method === 'GET') {
        const registro = await almacen.leer();
        responder(res, 200, registro);
        return true;
      }

      if (ruta === '/api/estado' && req.method === 'PUT') {
        const cuerpo = await leerCuerpo(req);
        if (!cuerpo || typeof cuerpo.version !== 'number') {
          responder(res, 400, { error: 'Falta la versión del estado que se está reemplazando.' });
          return true;
        }
        try {
          const registro = await almacen.guardar(cuerpo.version, sanear(cuerpo.datos), sesion.correo);
          responder(res, 200, registro);
        } catch (e) {
          if (e.conflicto) {
            /* Otro dispositivo guardó primero. Se devuelve lo que hay para que
               el cliente pueda mostrarlo en vez de perder trabajo. */
            responder(res, 409, {
              error: 'Otro dispositivo guardó cambios mientras tanto.',
              actual: e.actual
            });
            return true;
          }
          throw e;
        }
        return true;
      }

      if (ruta === '/api/usuarios' && req.method === 'GET') {
        const colaboradores = await usuarios.listar();
        responder(res, 200, {
          administradores: usuarios.ADMINISTRADORES,
          colaboradores: colaboradores,
          esAdmin: sesion.esAdmin
        });
        return true;
      }

      /* Añadir o quitar acceso son operaciones de administrador. Se comprueba
         con el dato calculado por el servidor a partir de CORREOS_AUTORIZADOS,
         nunca con nada que mande el cliente: así un colaborador no puede darse
         a sí mismo (ni a nadie) más permiso del que tiene. */
      if (ruta === '/api/usuarios' && (req.method === 'POST' || req.method === 'DELETE')) {
        if (!sesion.esAdmin) {
          responder(res, 403, { error: 'Sólo un administrador puede gestionar quién tiene acceso.' });
          return true;
        }

        const cuerpo = await leerCuerpo(req);
        if (!cuerpo || !cuerpo.correo) {
          responder(res, 400, { error: 'Falta el correo electrónico.' });
          return true;
        }

        try {
          const colaboradores = req.method === 'POST'
            ? await usuarios.agregar(cuerpo.correo, sesion.correo)
            : await usuarios.quitar(cuerpo.correo);
          responder(res, 200, { administradores: usuarios.ADMINISTRADORES, colaboradores: colaboradores });
        } catch (e) {
          if (e.estado) { responder(res, e.estado, { error: e.message }); return true; }
          throw e;
        }
        return true;
      }

      responder(res, 404, { error: 'Ruta no encontrada.' });
      return true;
    } catch (e) {
      console.error('Error en la API:', e);
      responder(res, e.estado || 500, { error: e.estado ? e.message : 'Error interno del servidor.' });
      return true;
    }
  };
}

module.exports = { crearApi };
