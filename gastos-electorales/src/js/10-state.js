/* Estado de la aplicación y su persistencia.
   En modo servidor los datos viven en la base de datos y se comparten entre
   dispositivos; el navegador guarda una copia que sirve de respaldo si se cae
   la conexión. En modo local el navegador es el único almacén.
   La interfaz (estado / muta / suscribir) es la misma en ambos casos, de modo
   que las vistas no saben de dónde vienen los datos. */
(function (App) {
  'use strict';

  var CLAVE = 'gastos-electorales:v1';
  var ESPERA_GUARDADO = 800; // ms de calma antes de mandar al servidor

  /* Tipologías de colaborador. El orden manda en la UI y en los informes.
     `agregable: false` marca los conceptos que, por decisión de negocio, no se
     suman al reparto territorial. */
  var COLABORADORES = [
    { id: 'representantes', nombre: 'Representantes de la Administración', agregable: true },
    { id: 'secretarios', nombre: 'Secretarios de Ayuntamiento', agregable: true },
    { id: 'juecesPaz', nombre: 'Jueces de Paz', agregable: true },
    { id: 'acondicionamiento', nombre: 'Acondicionamiento de locales', agregable: true },
    { id: 'personalColaborador', nombre: 'Personal colaborador', agregable: true },
    { id: 'montajeTransporte', nombre: 'Montaje y transporte', agregable: true },
    { id: 'policia', nombre: 'Policía Autonómica y Local', agregable: true },
    { id: 'miembrosMesa', nombre: 'Miembros de mesas electorales', agregable: true },
    { id: 'coordinadores', nombre: 'Coordinadores de tablets', agregable: false }
  ];

  var TIPOLOGIAS_PD = ['PD0', 'PD1', 'PD2', 'PD3', 'PD4', 'PD5'];

  function configPorDefecto() {
    return {
      representantes: { PD0: 130, PD1: 170, PD2: 190, PD3: 210, PD4: 230, PD5: 250 },
      secretarios: { hasta10: 100, de11a50: 180, mas50: 250 },
      juecesPaz: 45,
      acondicionamiento: 60,
      personalColaborador: 85,
      montajeTransporte: 110,
      policia: 90,
      miembrosMesa: 70,
      /* Miembros por mesa. El briefing fija 3; se deja configurable porque es
         el tipo de constante que cambia entre convocatorias. */
      miembrosPorMesa: 3,
      coordinadores: { tarifaHasta10: 120, tarifaDesde11: 140, numHasta10: 0, numDesde11: 0 }
    };
  }

  function estadoPorDefecto() {
    return {
      version: 1,
      convocatoria: 'Proceso electoral',
      config: configPorDefecto(),
      mesas: {},            // codigo -> nº de mesas
      representantes: {},   // codigo -> { PD0: n, ... }
      policia: {},          // codigo -> nº de efectivos
      cargas: {}            // censo -> { fecha, fichero, filas }
    };
  }

  /* Mezcla lo guardado sobre los valores por defecto, para que una versión que
     añada un campo nuevo no rompa unos datos antiguos. */
  function fusiona(base, guardado) {
    if (!guardado || typeof guardado !== 'object') { return base; }
    Object.keys(guardado).forEach(function (k) {
      var v = guardado[k];
      if (v && typeof v === 'object' && !Array.isArray(v) &&
          base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        fusiona(base[k], v);
      } else if (v !== undefined && v !== null) {
        base[k] = v;
      }
    });
    return base;
  }

  var estado = estadoPorDefecto();
  var suscriptores = [];

  /* Estado de la sincronización, para que la interfaz pueda decir la verdad
     sobre si lo que se ve está guardado o no. */
  var sync = {
    modo: 'local',        // 'servidor' | 'local'
    situacion: 'inactivo', // inactivo | guardando | guardado | pendiente | error | conflicto
    version: 0,           // versión del documento en el servidor
    actualizado: null,
    actualizadoPor: null,
    mensaje: null
  };

  var temporizador = null;
  var guardadoEnCurso = false;
  var hayCambiosPendientes = false;

  /* ---------- Copia local, que hace de respaldo ---------- */

  function guardarEnNavegador() {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify({ datos: estado, version: sync.version }));
    } catch (e) { /* modo privado o cuota llena: se sigue sin copia */ }
  }

  function leerDelNavegador() {
    try {
      var bruto = window.localStorage.getItem(CLAVE);
      if (!bruto) { return null; }
      var obj = JSON.parse(bruto);
      /* Formato antiguo: el estado estaba guardado en la raíz. */
      return obj && obj.datos ? obj : { datos: obj, version: 0 };
    } catch (e) { return null; }
  }

  function notificar() {
    suscriptores.forEach(function (fn) { fn(estado); });
  }

  function cambiarSituacion(situacion, mensaje) {
    sync.situacion = situacion;
    sync.mensaje = mensaje || null;
    if (App.render) { App.render(); }
  }

  /* ---------- Guardado en el servidor ---------- */

  function programarGuardado() {
    if (sync.modo !== 'servidor') { return; }
    hayCambiosPendientes = true;
    sync.situacion = 'pendiente';
    if (temporizador) { clearTimeout(temporizador); }
    temporizador = setTimeout(enviar, ESPERA_GUARDADO);
  }

  function enviar() {
    if (sync.modo !== 'servidor' || guardadoEnCurso) { return; }
    if (!hayCambiosPendientes) { return; }

    guardadoEnCurso = true;
    hayCambiosPendientes = false;
    cambiarSituacion('guardando');

    var instantanea = JSON.parse(JSON.stringify(estado));

    App.api.guardarEstado(sync.version, instantanea)
      .then(function (registro) {
        sync.version = registro.version;
        sync.actualizado = registro.actualizado;
        sync.actualizadoPor = registro.actualizadoPor;
        guardarEnNavegador();
        guardadoEnCurso = false;
        /* Si algo cambió mientras se guardaba, se vuelve a mandar. */
        if (hayCambiosPendientes) { enviar(); }
        else { cambiarSituacion('guardado'); }
      })
      .catch(function (err) {
        guardadoEnCurso = false;

        if (err.estado === 409) {
          /* Otro dispositivo guardó antes. No se pisa nada: se avisa y se deja
             que la persona decida cuál de las dos versiones vale. */
          sync.situacion = 'conflicto';
          sync.conflicto = err.cuerpo && err.cuerpo.actual;
          if (App.resolverConflicto) { App.resolverConflicto(sync.conflicto); }
          else if (App.render) { App.render(); }
          return;
        }

        if (err.estado === 401 || err.estado === 403) {
          cambiarSituacion('error', 'La sesión ha caducado. Vuelva a entrar para guardar.');
          if (App.pedirSesion) { App.pedirSesion(); }
          return;
        }

        hayCambiosPendientes = true;
        cambiarSituacion('error', err.message || 'No se pudo guardar. Se reintentará.');
        setTimeout(enviar, 5000);
      });
  }

  /* ---------- Arranque ---------- */

  function aplicarRegistro(registro) {
    var base = estadoPorDefecto();
    fusiona(base, registro.datos || {});
    estado = base;
    sync.version = registro.version || 0;
    sync.actualizado = registro.actualizado || null;
    sync.actualizadoPor = registro.actualizadoPor || null;
  }

  /* Carga inicial. Devuelve una promesa porque en modo servidor hay que esperar
     a la base de datos antes de pintar nada. */
  function iniciar(modo) {
    sync.modo = modo;

    if (modo !== 'servidor') {
      var copia = leerDelNavegador();
      if (copia) { aplicarRegistro({ datos: copia.datos, version: copia.version }); }
      sync.situacion = 'inactivo';
      return Promise.resolve();
    }

    return App.api.leerEstado().then(function (registro) {
      aplicarRegistro(registro);
      guardarEnNavegador();
      sync.situacion = 'guardado';
    }).catch(function (err) {
      /* Sin respuesta del servidor se trabaja con la última copia conocida,
         pero dejándolo claro: lo que se vea puede estar desfasado. */
      var copia = leerDelNavegador();
      if (copia) { aplicarRegistro({ datos: copia.datos, version: copia.version }); }
      sync.situacion = 'error';
      sync.mensaje = 'No se pudo leer del servidor. Se muestra la última copia de este dispositivo.';
      throw err;
    });
  }

  App.store = {
    COLABORADORES: COLABORADORES,
    TIPOLOGIAS_PD: TIPOLOGIAS_PD,
    colaborador: function (id) {
      for (var i = 0; i < COLABORADORES.length; i++) {
        if (COLABORADORES[i].id === id) { return COLABORADORES[i]; }
      }
      return null;
    },

    iniciar: iniciar,
    estado: function () { return estado; },
    sincronizacion: function () { return sync; },

    /* muta(fn) aplica el cambio, deja copia local al instante y programa el
       guardado en el servidor. Las vistas la usan igual que antes. */
    muta: function (fn) {
      fn(estado);
      guardarEnNavegador();
      programarGuardado();
      notificar();
    },

    /* Fuerza el envío inmediato, sin esperar la pausa. */
    guardarYa: function () {
      if (temporizador) { clearTimeout(temporizador); }
      hayCambiosPendientes = true;
      enviar();
    },

    reiniciar: function () {
      estado = estadoPorDefecto();
      guardarEnNavegador();
      programarGuardado();
      notificar();
    },

    exportar: function () { return JSON.parse(JSON.stringify(estado)); },

    importar: function (obj) {
      estado = fusiona(estadoPorDefecto(), obj);
      guardarEnNavegador();
      programarGuardado();
      notificar();
    },

    /* Adopta lo que hay en el servidor, descartando los cambios locales. */
    adoptarDelServidor: function (registro) {
      aplicarRegistro(registro);
      guardarEnNavegador();
      hayCambiosPendientes = false;
      sync.conflicto = null;
      cambiarSituacion('guardado');
      notificar();
    },

    /* Impone lo local sobre lo del servidor, tras un conflicto. */
    imponerLocal: function (versionServidor) {
      sync.version = versionServidor;
      sync.conflicto = null;
      hayCambiosPendientes = true;
      enviar();
    },

    suscribir: function (fn) { suscriptores.push(fn); }
  };
})(window.App = window.App || {});
