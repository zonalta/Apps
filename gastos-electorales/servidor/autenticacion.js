/* Autenticación por cuenta de Google.
   El navegador obtiene un identificador firmado por Google y lo manda en cada
   petición; aquí se comprueba la firma y que el correo esté en la lista de
   autorizados. No se guarda ninguna contraseña ni secreto: sólo se verifica lo
   que Google ya ha firmado. */
'use strict';

const { OAuth2Client } = require('google-auth-library');
const usuarios = require('./usuarios');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const MODO = (process.env.AUTH_MODO || 'google').toLowerCase();

/* Interlocking de seguridad: el modo de desarrollo salta la verificación, así
   que no puede convivir con Cloud Run bajo ningún concepto. K_SERVICE sólo
   existe dentro de Cloud Run. */
if (MODO === 'desarrollo' && process.env.K_SERVICE) {
  console.error('AUTH_MODO=desarrollo no se admite en Cloud Run. Abortando.');
  process.exit(1);
}

const cliente = new OAuth2Client(CLIENT_ID);

function configurado() {
  if (MODO === 'desarrollo') { return true; }
  return Boolean(CLIENT_ID) && usuarios.ADMINISTRADORES.length > 0;
}

function motivoSinConfigurar() {
  if (!CLIENT_ID) { return 'Falta la variable GOOGLE_CLIENT_ID en el servicio.'; }
  if (!usuarios.ADMINISTRADORES.length) { return 'Falta la variable CORREOS_AUTORIZADOS en el servicio.'; }
  return null;
}

function extraerCredencial(req) {
  const cabecera = req.headers.authorization || '';
  const partes = cabecera.split(' ');
  if (partes.length === 2 && /^Bearer$/i.test(partes[0])) { return partes[1]; }
  return null;
}

/* Devuelve { correo, nombre, foto } o lanza un error con .estado y .mensaje. */
async function identificar(req) {
  if (MODO === 'desarrollo') {
    console.warn('AUTH_MODO=desarrollo — petición aceptada sin verificar identidad.');
    return { correo: 'desarrollo@local', nombre: 'Modo desarrollo', foto: null, esAdmin: true };
  }

  if (!configurado()) {
    const err = new Error(motivoSinConfigurar());
    err.estado = 503;
    throw err;
  }

  const credencial = extraerCredencial(req);
  if (!credencial) {
    const err = new Error('Falta la credencial de acceso.');
    err.estado = 401;
    throw err;
  }

  let carga;
  try {
    const ticket = await cliente.verifyIdToken({
      idToken: credencial,
      audience: CLIENT_ID
    });
    carga = ticket.getPayload();
  } catch (e) {
    const err = new Error('La credencial no es válida o ha caducado.');
    err.estado = 401;
    throw err;
  }

  /* Google marca si ha comprobado el correo. Sin esa comprobación, el correo no
     identifica a nadie de forma fiable y la lista de autorizados no valdría. */
  if (!carga.email || carga.email_verified !== true) {
    const err = new Error('La cuenta de Google no tiene el correo verificado.');
    err.estado = 403;
    throw err;
  }

  const correo = carga.email.toLowerCase();
  if (!(await usuarios.estaAutorizado(correo))) {
    const err = new Error('La cuenta ' + correo + ' no tiene acceso a esta aplicación.');
    err.estado = 403;
    throw err;
  }

  return {
    correo: correo,
    nombre: carga.name || correo,
    foto: carga.picture || null,
    esAdmin: usuarios.esAdmin(correo)
  };
}

/* Lo que el navegador necesita saber antes de iniciar sesión. El identificador
   de cliente es público por diseño: no es un secreto. */
function configuracionPublica() {
  return {
    modo: MODO,
    clienteId: CLIENT_ID || null,
    configurado: configurado(),
    aviso: configurado() ? null : motivoSinConfigurar()
  };
}

module.exports = { identificar, configuracionPublica, configurado };
