/* Comunicación con el servidor y sesión de Google.
   La aplicación funciona en dos modos:
     - «servidor»: hay API detrás, hace falta iniciar sesión y los datos viven
       en la base de datos, compartidos entre dispositivos.
     - «local»: no hay API (fichero abierto directamente, vista previa). Los
       datos se quedan en este navegador y se avisa de ello.
   El modo se detecta al arrancar, no se configura. */
(function (App) {
  'use strict';

  var GUION_GOOGLE = 'https://accounts.google.com/gsi/client';
  var CLAVE_CREDENCIAL = 'gastos-electorales:credencial';

  var estado = {
    modo: null,        // 'servidor' | 'local'
    clienteId: null,
    aviso: null,
    sesion: null,      // { correo, nombre, foto }
    credencial: null,
    version: null      // { commit, revision } — null en modo local
  };

  function recordarCredencial(valor) {
    estado.credencial = valor;
    try {
      if (valor) { window.sessionStorage.setItem(CLAVE_CREDENCIAL, valor); }
      else { window.sessionStorage.removeItem(CLAVE_CREDENCIAL); }
    } catch (e) { /* sin sessionStorage la sesión dura lo que la pestaña */ }
  }

  function recuperarCredencial() {
    try { return window.sessionStorage.getItem(CLAVE_CREDENCIAL); }
    catch (e) { return null; }
  }

  function peticion(ruta, opciones) {
    opciones = opciones || {};
    var cabeceras = { 'Content-Type': 'application/json' };
    if (estado.credencial) {
      cabeceras.Authorization = 'Bearer ' + estado.credencial;
    }
    return fetch(ruta, {
      method: opciones.metodo || 'GET',
      headers: cabeceras,
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (cuerpo) {
        if (r.ok) { return cuerpo; }
        var err = new Error(cuerpo.error || ('Error ' + r.status));
        err.estado = r.status;
        err.cuerpo = cuerpo;
        throw err;
      });
    });
  }

  /* Averigua si hay servidor detrás. Un fallo de red aquí no es un error:
     significa que la aplicación se está usando suelta. */
  function detectarModo() {
    /* Un fichero abierto directamente nunca tiene API detrás, y preguntar por
       ella sólo ensucia la consola con un error de CORS. */
    if (window.location.protocol === 'file:') {
      estado.modo = 'local';
      return Promise.resolve(estado);
    }

    return fetch('/api/configuracion', { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) { throw new Error('sin api'); }
        return r.json();
      })
      .then(function (cfg) {
        estado.modo = 'servidor';
        estado.clienteId = cfg.clienteId;
        estado.aviso = cfg.aviso;
        estado.modoAuth = cfg.modo;
        estado.configurado = cfg.configurado === true;
        estado.version = cfg.version || null;
        estado.credencial = recuperarCredencial();
        return estado;
      })
      .catch(function () {
        estado.modo = 'local';
        return estado;
      });
  }

  /* Carga el script de Google una sola vez. */
  var promesaGoogle = null;
  function cargarGoogle() {
    if (promesaGoogle) { return promesaGoogle; }
    promesaGoogle = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts) { return resolve(); }
      var s = document.createElement('script');
      s.src = GUION_GOOGLE;
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('No se pudo cargar el acceso de Google. Compruebe la conexión.'));
      };
      document.head.appendChild(s);
    });
    return promesaGoogle;
  }

  /* Pinta el botón oficial de Google dentro del contenedor indicado. */
  function pintarBotonAcceso(contenedor, alEntrar, alFallar) {
    cargarGoogle().then(function () {
      window.google.accounts.id.initialize({
        client_id: estado.clienteId,
        callback: function (respuesta) {
          recordarCredencial(respuesta.credential);
          verificarSesion().then(alEntrar).catch(alFallar);
        }
      });
      window.google.accounts.id.renderButton(contenedor, {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        locale: 'es',
        width: 280
      });
    }).catch(alFallar);
  }

  function verificarSesion() {
    return peticion('/api/sesion').then(function (s) {
      estado.sesion = s;
      return s;
    });
  }

  function cerrarSesion() {
    recordarCredencial(null);
    estado.sesion = null;
    try {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) { /* da igual si Google no está cargado */ }
  }

  App.api = {
    estado: function () { return estado; },
    detectarModo: detectarModo,
    pintarBotonAcceso: pintarBotonAcceso,
    verificarSesion: verificarSesion,
    cerrarSesion: cerrarSesion,
    leerEstado: function () { return peticion('/api/estado'); },
    guardarEstado: function (version, datos) {
      return peticion('/api/estado', { metodo: 'PUT', cuerpo: { version: version, datos: datos } });
    },
    listarUsuarios: function () { return peticion('/api/usuarios'); },
    darAcceso: function (correo, rol) {
      return peticion('/api/usuarios', { metodo: 'POST', cuerpo: { correo: correo, rol: rol } });
    },
    quitarAcceso: function (correo) {
      return peticion('/api/usuarios', { metodo: 'DELETE', cuerpo: { correo: correo } });
    }
  };
})(window.App = window.App || {});
