/* Estado de la aplicación y su persistencia.
   En esta fase el almacén es localStorage (por dispositivo). El acceso pasa
   siempre por App.store, de modo que sustituirlo por una API REST contra el
   backend en Cloud Run afecta sólo a este fichero. */
(function (App) {
  'use strict';

  var CLAVE = 'gastos-electorales:v1';

  /* Tipologías de colaborador. El orden manda en la UI y en los informes.
     `agregable: false` marca los conceptos que, por decisión de negocio, no se
     suman al reparto territorial (los coordinadores todavía no cuelgan de un
     municipio). */
  var COLABORADORES = [
    { id: 'representantes', nombre: 'Representantes de la Administración', base: 'representantes', agregable: true },
    { id: 'secretarios', nombre: 'Secretarios de Ayuntamiento', base: 'tramo-mesas', agregable: true },
    { id: 'juecesPaz', nombre: 'Jueces de Paz', base: 'municipio', agregable: true },
    { id: 'acondicionamiento', nombre: 'Acondicionamiento de locales', base: 'mesas', agregable: true },
    { id: 'personalColaborador', nombre: 'Personal colaborador', base: 'mesas', agregable: true },
    { id: 'montajeTransporte', nombre: 'Montaje y transporte', base: 'mesas', agregable: true },
    { id: 'policia', nombre: 'Policía Autonómica y Local', base: 'efectivos', agregable: true },
    { id: 'miembrosMesa', nombre: 'Miembros de mesas electorales', base: 'mesas-x3', agregable: true },
    { id: 'coordinadores', nombre: 'Coordinadores de tablets', base: 'global', agregable: false }
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
      coordinadores: {
        tarifaHasta10: 120,
        tarifaDesde11: 140,
        numHasta10: 0,
        numDesde11: 0
      }
    };
  }

  function estadoPorDefecto() {
    return {
      version: 1,
      convocatoria: 'Proceso electoral',
      config: configPorDefecto(),
      /* Datos cargados por municipio, indexados por código INE. */
      mesas: {},            // codigo -> nº de mesas
      representantes: {},   // codigo -> { PD0: n, ... }
      policia: {},          // codigo -> nº de efectivos
      cargas: {}            // origen -> { fecha, fichero, filas }
    };
  }

  /* Mezcla superficial y recursiva de los valores guardados sobre los valores por
     defecto, para que una versión nueva que añada un campo no rompa un estado
     antiguo. */
  function fusiona(base, guardado) {
    if (!guardado || typeof guardado !== 'object') { return base; }
    Object.keys(guardado).forEach(function (k) {
      var v = guardado[k];
      if (v && typeof v === 'object' && !Array.isArray(v) &&
          base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        fusiona(base[k], v);
      } else if (v !== undefined) {
        base[k] = v;
      }
    });
    return base;
  }

  var estado = estadoPorDefecto();
  var suscriptores = [];

  function cargar() {
    var bruto = null;
    try { bruto = window.localStorage.getItem(CLAVE); } catch (e) { bruto = null; }
    if (!bruto) { return; }
    try {
      estado = fusiona(estadoPorDefecto(), JSON.parse(bruto));
    } catch (e) {
      console.warn('Estado guardado ilegible, se parte de los valores por defecto', e);
    }
  }

  function guardar() {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      console.warn('No se pudo guardar el estado', e);
      return false;
    }
    return true;
  }

  function notificar() {
    suscriptores.forEach(function (fn) { fn(estado); });
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
    init: cargar,
    estado: function () { return estado; },
    /* muta(fn) aplica el cambio, persiste y avisa a las vistas. */
    muta: function (fn) {
      fn(estado);
      guardar();
      notificar();
    },
    reiniciar: function () {
      estado = estadoPorDefecto();
      guardar();
      notificar();
    },
    exportar: function () { return JSON.parse(JSON.stringify(estado)); },
    importar: function (obj) {
      estado = fusiona(estadoPorDefecto(), obj);
      guardar();
      notificar();
    },
    suscribir: function (fn) { suscriptores.push(fn); }
  };
})(window.App = window.App || {});
