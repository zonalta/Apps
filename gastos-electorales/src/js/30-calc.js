/* Motor de cálculo de gastos.
   Todo el dinero se calcula aquí y en ningún otro sitio: las vistas sólo pintan
   lo que devuelven estas funciones. */
(function (App) {
  'use strict';

  var PD = App.store.TIPOLOGIAS_PD;

  /* Un municipio se considera activo cuando tiene mesas cargadas. Los conceptos
     que se cobran "por municipio" (secretario, juez de paz) sólo devengan en los
     municipios activos: sin mesas no hay proceso electoral que atender. */
  function estaActivo(estado, codigo) {
    return (Number(estado.mesas[codigo]) || 0) > 0;
  }

  function tramoSecretario(cfg, mesas) {
    if (mesas <= 0) { return 0; }
    if (mesas <= 10) { return Number(cfg.secretarios.hasta10) || 0; }
    if (mesas <= 50) { return Number(cfg.secretarios.de11a50) || 0; }
    return Number(cfg.secretarios.mas50) || 0;
  }

  /* Desglose de un municipio: importe y "cantidad" (la magnitud sobre la que se
     calcula) por cada tipología agregable. */
  function calcularMunicipio(estado, codigo) {
    var cfg = estado.config;
    var mesas = Number(estado.mesas[codigo]) || 0;
    var efectivos = Number(estado.policia[codigo]) || 0;
    var reps = estado.representantes[codigo] || {};
    var activo = mesas > 0;

    var nRepresentantes = 0;
    var importeRepresentantes = 0;
    PD.forEach(function (t) {
      var n = Number(reps[t]) || 0;
      nRepresentantes += n;
      importeRepresentantes += n * (Number(cfg.representantes[t]) || 0);
    });

    var lineas = {
      representantes: {
        cantidad: nRepresentantes,
        unidad: 'representantes',
        importeUnitario: nRepresentantes ? importeRepresentantes / nRepresentantes : 0,
        importe: importeRepresentantes
      },
      secretarios: {
        cantidad: activo ? 1 : 0,
        unidad: 'secretarios',
        importeUnitario: tramoSecretario(cfg, mesas),
        importe: activo ? tramoSecretario(cfg, mesas) : 0
      },
      juecesPaz: {
        cantidad: activo ? 1 : 0,
        unidad: 'jueces',
        importeUnitario: Number(cfg.juecesPaz) || 0,
        importe: activo ? (Number(cfg.juecesPaz) || 0) : 0
      },
      acondicionamiento: {
        cantidad: mesas,
        unidad: 'mesas',
        importeUnitario: Number(cfg.acondicionamiento) || 0,
        importe: mesas * (Number(cfg.acondicionamiento) || 0)
      },
      personalColaborador: {
        cantidad: mesas,
        unidad: 'mesas',
        importeUnitario: Number(cfg.personalColaborador) || 0,
        importe: mesas * (Number(cfg.personalColaborador) || 0)
      },
      montajeTransporte: {
        cantidad: mesas,
        unidad: 'mesas',
        importeUnitario: Number(cfg.montajeTransporte) || 0,
        importe: mesas * (Number(cfg.montajeTransporte) || 0)
      },
      policia: {
        cantidad: efectivos,
        unidad: 'efectivos',
        importeUnitario: Number(cfg.policia) || 0,
        importe: efectivos * (Number(cfg.policia) || 0)
      },
      miembrosMesa: {
        cantidad: mesas * (Number(cfg.miembrosPorMesa) || 0),
        unidad: 'miembros',
        importeUnitario: Number(cfg.miembrosMesa) || 0,
        importe: mesas * (Number(cfg.miembrosPorMesa) || 0) * (Number(cfg.miembrosMesa) || 0)
      }
    };

    return {
      codigo: codigo,
      mesas: mesas,
      efectivos: efectivos,
      activo: activo,
      representantesPorTipo: reps,
      lineas: lineas
    };
  }

  /* Los coordinadores de tablets viven fuera del reparto territorial: se
     configuran como totales y se informan aparte. */
  function calcularCoordinadores(estado) {
    var c = estado.config.coordinadores || {};
    var nA = Number(c.numHasta10) || 0;
    var nB = Number(c.numDesde11) || 0;
    var tA = Number(c.tarifaHasta10) || 0;
    var tB = Number(c.tarifaDesde11) || 0;
    return {
      hasta10: { cantidad: nA, importeUnitario: tA, importe: nA * tA },
      desde11: { cantidad: nB, importeUnitario: tB, importe: nB * tB },
      total: nA * tA + nB * tB
    };
  }

  /* Personal de Delegación y Subdelegación del Gobierno: igual que los
     coordinadores, un importe global que se escribe directamente en
     Configuración, sin tarifa ni cantidad de por medio. */
  function calcularGlobalesFijos(estado) {
    var out = {};
    App.store.GLOBALES_FIJOS.forEach(function (id) {
      out[id] = { importe: Number(estado.config[id]) || 0 };
    });
    return out;
  }

  /* Aplica los filtros del informe y devuelve los códigos de municipio en ámbito.
     filtros = { provincias: [], islas: [], municipios: [], soloActivos: bool } */
  function municipiosEnAmbito(estado, filtros) {
    return App.geo.ordenarPorNombre(App.geo.MUNICIPIOS).filter(function (m) {
      if (filtros.provincias && filtros.provincias.length &&
          filtros.provincias.indexOf(m.provincia) < 0) { return false; }
      if (filtros.islas && filtros.islas.length &&
          filtros.islas.indexOf(m.isla) < 0) { return false; }
      if (filtros.municipios && filtros.municipios.length &&
          filtros.municipios.indexOf(m.codigo) < 0) { return false; }
      if (filtros.soloActivos && !estaActivo(estado, m.codigo)) { return false; }
      return true;
    }).map(function (m) { return m.codigo; });
  }

  /* Construye el informe completo para un ámbito y una selección de tipologías. */
  function generarInforme(estado, filtros, tiposSeleccionados) {
    var codigos = municipiosEnAmbito(estado, filtros);
    var tipos = tiposSeleccionados || [];

    var porMunicipio = [];
    var totalPorTipo = {};
    var cantidadPorTipo = {};
    App.store.COLABORADORES.forEach(function (c) {
      totalPorTipo[c.id] = 0;
      cantidadPorTipo[c.id] = 0;
    });

    var totalGeneral = 0;
    var totalMesas = 0;
    var municipiosActivos = 0;

    codigos.forEach(function (codigo) {
      var det = calcularMunicipio(estado, codigo);
      var geo = App.geo.municipio(codigo);
      var subtotal = 0;
      var lineasFiltradas = {};

      Object.keys(det.lineas).forEach(function (tipo) {
        if (tipos.indexOf(tipo) < 0) { return; }
        var l = det.lineas[tipo];
        lineasFiltradas[tipo] = l;
        subtotal += l.importe;
        totalPorTipo[tipo] += l.importe;
        cantidadPorTipo[tipo] += l.cantidad;
      });

      totalMesas += det.mesas;
      if (det.activo) { municipiosActivos += 1; }
      totalGeneral += subtotal;

      porMunicipio.push({
        codigo: codigo,
        nombre: geo.nombre,
        isla: geo.isla,
        islaNombre: App.geo.isla(geo.isla).nombre,
        provincia: geo.provincia,
        provinciaNombre: App.geo.provincia(geo.provincia).nombre,
        mesas: det.mesas,
        efectivos: det.efectivos,
        activo: det.activo,
        lineas: lineasFiltradas,
        subtotal: subtotal
      });
    });

    /* Agregados territoriales, calculados sobre los municipios ya filtrados. */
    function agrupar(clave, nombreClave) {
      var mapa = {};
      porMunicipio.forEach(function (m) {
        var k = m[clave];
        if (!mapa[k]) {
          mapa[k] = { id: k, nombre: m[nombreClave], importe: 0, mesas: 0, municipios: 0 };
        }
        mapa[k].importe += m.subtotal;
        mapa[k].mesas += m.mesas;
        mapa[k].municipios += 1;
      });
      return Object.keys(mapa).map(function (k) { return mapa[k]; })
        .sort(function (a, b) { return b.importe - a.importe; });
    }

    var coordinadores = calcularCoordinadores(estado);
    var incluyeCoordinadores = tipos.indexOf('coordinadores') >= 0;

    /* El resto de conceptos globales: se suman los que estén seleccionados
       en el informe, cada uno con su propio importe fijo. */
    var globalesFijos = calcularGlobalesFijos(estado);
    var totalGlobalesFijos = 0;
    App.store.GLOBALES_FIJOS.forEach(function (id) {
      if (tipos.indexOf(id) >= 0) { totalGlobalesFijos += globalesFijos[id].importe; }
    });

    return {
      generadoEn: new Date(),
      filtros: filtros,
      tipos: tipos,
      porMunicipio: porMunicipio,
      porIsla: agrupar('isla', 'islaNombre'),
      porProvincia: agrupar('provincia', 'provinciaNombre'),
      totalPorTipo: totalPorTipo,
      cantidadPorTipo: cantidadPorTipo,
      totalMesas: totalMesas,
      municipiosEnAmbito: codigos.length,
      municipiosActivos: municipiosActivos,
      /* Total territorial: la suma de todo lo que se reparte por municipio. */
      totalTerritorial: totalGeneral,
      coordinadores: coordinadores,
      incluyeCoordinadores: incluyeCoordinadores,
      globalesFijos: globalesFijos,
      totalGlobalesFijos: totalGlobalesFijos,
      /* Total general: territorial + los conceptos globales seleccionados,
         que van aparte por diseño. */
      total: totalGeneral + (incluyeCoordinadores ? coordinadores.total : 0) + totalGlobalesFijos
    };
  }

  App.calc = {
    calcularMunicipio: calcularMunicipio,
    calcularCoordinadores: calcularCoordinadores,
    calcularGlobalesFijos: calcularGlobalesFijos,
    municipiosEnAmbito: municipiosEnAmbito,
    tramoSecretario: tramoSecretario,
    generarInforme: generarInforme
  };
})(window.App = window.App || {});
