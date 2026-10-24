/* Exportación del Dashboard de Asistencia: cuadro para elegir qué sacar y en
   qué formato, un Excel con una hoja por bloque y un informe para PDF. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var X = App.xlsx;
  var E = X.ESTILO;
  var CLAVE_PREFS = 'gastos-electorales:exportar-asistencia';

  var CONTENIDOS = [
    { id: 'resumen', nombre: 'Resumen', nota: 'Indicadores, totales por fase y subtotales por grupo' },
    { id: 'asistencias', nombre: 'Asistencias por ámbito', nota: 'Asistencias por fase, total e importe' },
    { id: 'desglose', nombre: 'Desglose de importes', nota: 'Importe por fase y coste por unidad funcional' },
    { id: 'grafica', nombre: 'Gráfica por fases', nota: 'Sólo en el PDF' },
    { id: 'maximos', nombre: 'Asistencias frente al máximo', nota: 'Con aviso de los máximos superados' },
    { id: 'config', nombre: 'Parámetros de configuración', nota: 'Horas, importes y unidades de cada ámbito' }
  ];

  /* ---------- Preferencias (sólo comodidad; sin ellas todo sigue funcionando) ---------- */

  function porDefecto() {
    var contenido = {};
    CONTENIDOS.forEach(function (c) { contenido[c.id] = true; });
    return { contenido: contenido, grupos: null, detalle: 'ambitos', formato: 'ambos', titulo: '', notas: '' };
  }

  function leerPrefs() {
    var op = porDefecto();
    try {
      var g = JSON.parse(window.localStorage.getItem(CLAVE_PREFS) || 'null');
      if (g) {
        CONTENIDOS.forEach(function (c) { if (g.contenido && typeof g.contenido[c.id] === 'boolean') { op.contenido[c.id] = g.contenido[c.id]; } });
        if (g.detalle === 'ambitos' || g.detalle === 'grupos') { op.detalle = g.detalle; }
        if (['excel', 'pdf', 'ambos'].indexOf(g.formato) >= 0) { op.formato = g.formato; }
        if (typeof g.titulo === 'string') { op.titulo = g.titulo; }
        if (Array.isArray(g.grupos)) { op.grupos = g.grupos; }
      }
    } catch (e) { /* sin almacenamiento o dato corrupto: valores por defecto */ }
    var ids = App.asistencia.grupos().map(function (x) { return x.id; });
    op.grupos = (op.grupos || ids).filter(function (id) { return ids.indexOf(id) >= 0; });
    if (!op.grupos.length) { op.grupos = ids.slice(); }
    return op;
  }

  function guardarPrefs(op) {
    try {
      window.localStorage.setItem(CLAVE_PREFS, JSON.stringify({
        contenido: op.contenido, grupos: op.grupos, detalle: op.detalle, formato: op.formato, titulo: op.titulo
      }));
    } catch (e) { /* no pasa nada */ }
  }

  /* ---------- Datos de la exportación ---------- */

  function modelo(op) {
    var A = App.asistencia;
    var d = A.datosAnalisis(op.grupos);
    d.excesos = 0;
    d.grupos.forEach(function (gd) {
      gd.excedidos = 0;
      gd.maxSub = { previa: 0, electoral: 0, cierre: 0 };
      gd.filas.forEach(function (f) {
        f.asist = {}; f.max = {}; f.excede = {};
        A.FASES.forEach(function (fa) {
          f.asist[fa.id] = Number(A.asistenciasDe(f.ambito)[fa.id]) || 0;
          f.max[fa.id] = Number(A.sesionesDe(f.ambito)[fa.id]) || 0;
          f.excede[fa.id] = f.max[fa.id] > 0 && f.asist[fa.id] > f.max[fa.id];
          gd.maxSub[fa.id] += f.max[fa.id];
          if (f.excede[fa.id]) { gd.excedidos++; d.excesos++; }
        });
      });
    });
    var ordenadas = A.FASES.slice().sort(function (a, b) { return d.porFase[b.id] - d.porFase[a.id]; });
    d.faseCara = d.total ? ordenadas[0] : null;
    d.convocatoria = App.store.estado().convocatoria || '';
    d.fecha = new Date();
    d.titulo = op.titulo || 'Informe de asistencias';
    d.nombresGrupos = d.grupos.map(function (gd) { return gd.numero + ' ' + A.nombreDe(gd.grupo); });
    d.todosLosGrupos = d.grupos.length === A.grupos().length;
    return d;
  }

  function aPct(parte, total) { return total ? parte / total : 0; }

  /* ---------- Excel ---------- */

  function hojasExcel(d, op) {
    var A = App.asistencia;
    var F = A.FASES;
    var porAmbito = op.detalle === 'ambitos';
    var hojas = [];

    function cab(textos) { return textos.map(function (t) { return { v: t, s: E.cab }; }); }
    function euro(v) { return { v: v, s: E.euro }; }
    function ent(v) { return { v: v, s: E.ent }; }
    function gTxt(v) { return { v: v, s: E.grupo }; }
    function gEuro(v) { return { v: v, s: E.grupoEuro }; }
    function gEnt(v) { return { v: v, s: E.grupoEnt }; }
    function gPct(v) { return { v: v, s: E.grupoPct }; }
    function nEuro(v) { return { v: v, s: E.euroNeg }; }
    function nEnt(v) { return { v: v, s: E.entNeg }; }

    /* Hoja de datos: una fila por ámbito (con su grupo en una columna aparte,
       para filtrar y hacer tablas dinámicas) o una por grupo, y una fila final
       de totales fuera del autofiltro. */
    function hojaDatos(nombre, cabeceras, anchos, filasAmbito, filasGrupo, total) {
      var cuerpo = porAmbito ? filasAmbito() : filasGrupo();
      var filas = [cab(cabeceras)].concat(cuerpo);
      var ultima = filas.length;
      filas.push(total);
      hojas.push({
        nombre: nombre, filas: filas, anchos: anchos, congelar: 1,
        filtro: cuerpo.length ? 'A1:' + X.letra(cabeceras.length - 1) + ultima : null
      });
    }

    function porFilas(fnAmbito) {
      var out = [];
      d.grupos.forEach(function (gd) { gd.filas.forEach(function (f) { out.push(fnAmbito(gd, f)); }); });
      return out;
    }

    /* Resumen */
    if (op.contenido.resumen) {
      var r = [];
      r.push([{ v: d.titulo, s: E.titulo }]);
      r.push([{ v: (d.convocatoria ? d.convocatoria + ' · ' : '') + 'Importe por asistencia · ' + App.ui.fecha(d.fecha), s: E.nota }]);
      r.push([{ v: 'Grupos incluidos: ' + (d.todosLosGrupos ? 'todos' : d.nombresGrupos.join('; ')), s: E.nota }]);
      if (op.notas) { r.push([{ v: op.notas, s: E.nota }]); }
      r.push([]);
      r.push(cab(['Indicador', 'Valor']));
      r.push(['Coste total', euro(d.total)]);
      r.push(['Asistencias', ent(d.asistencias)]);
      r.push(['Unidades funcionales', ent(d.unidades)]);
      r.push(['Coste medio por asistencia', euro(d.asistencias ? d.total / d.asistencias : 0)]);
      r.push(['Fase más cara', d.faseCara ? d.faseCara.nombre + ' (' + App.ui.euro(d.porFase[d.faseCara.id]) + ')' : '—']);
      r.push([]);
      r.push(cab(['Fase', 'Asistencias', 'Importe', '% del total']));
      F.forEach(function (fa) {
        var asis = d.grupos.reduce(function (t, gd) { return t + gd.sub.asist[fa.id]; }, 0);
        r.push([fa.nombre, ent(asis), euro(d.porFase[fa.id]), { v: aPct(d.porFase[fa.id], d.total), s: E.pct }]);
      });
      r.push([{ v: 'Total', s: E.neg }, nEnt(d.asistencias), nEuro(d.total), { v: d.total ? 1 : 0, s: E.pctNeg }]);
      r.push([]);
      r.push(cab(['Nº', 'Grupo', 'Unidades funcionales'].concat(F.map(function (f) { return f.nombre; }), ['Total', '% del total'])));
      d.grupos.forEach(function (gd) {
        r.push([gd.numero, A.nombreDe(gd.grupo), ent(gd.sub.unidades)].concat(
          F.map(function (fa) { return euro(gd.sub.importes[fa.id]); }),
          [nEuro(gd.sub.total), { v: aPct(gd.sub.total, d.total), s: E.pct }]
        ));
      });
      r.push([{ v: '', s: E.neg }, { v: 'Total', s: E.neg }, nEnt(d.unidades)].concat(
        F.map(function (fa) { return nEuro(d.porFase[fa.id]); }), [nEuro(d.total), { v: d.total ? 1 : 0, s: E.pctNeg }]
      ));
      hojas.push({ nombre: 'Resumen', filas: r, anchos: [30, 34, 16, 16, 16, 16, 16, 12] });
    }

    /* Asistencias */
    if (op.contenido.asistencias) {
      var tAsis = ['', { v: 'Total', s: E.neg }, '', nEnt(d.unidades)].concat(
        F.map(function (fa) { return nEnt(d.grupos.reduce(function (t, gd) { return t + gd.sub.asist[fa.id]; }, 0)); }),
        [nEnt(d.asistencias), '', nEuro(d.total)]);
      hojaDatos('Asistencias',
        ['Nº', 'Grupo', 'Ámbito', 'Unidades funcionales'].concat(F.map(function (f) { return f.nombre; }), ['Total asistencias', 'Importe asistencia', 'Importe total']),
        [8, 30, 60, 14, 14, 16, 14, 14, 16, 16],
        function () {
          return porFilas(function (gd, f) {
            return [f.numero, A.nombreDe(gd.grupo), A.nombreDe(f.ambito), ent(Number(f.ambito.unidades) || 0)].concat(
              F.map(function (fa) { return ent(f.asist[fa.id]); }),
              [ent(A.totalAsistencias(f.ambito)), euro(A.importeSesion(f.ambito)), euro(f.total)]);
          });
        },
        function () {
          return d.grupos.map(function (gd) {
            return [gd.numero, A.nombreDe(gd.grupo), '', ent(gd.sub.unidades)].concat(
              F.map(function (fa) { return ent(gd.sub.asist[fa.id]); }), [ent(gd.sub.asistencias), '', euro(gd.sub.total)]);
          });
        }, tAsis);
    }

    /* Desglose */
    if (op.contenido.desglose) {
      hojaDatos('Desglose',
        ['Nº', 'Grupo', 'Ámbito', 'Unidades funcionales'].concat(F.map(function (f) { return f.nombre; }), ['Total', 'Coste por unidad funcional', '% del total']),
        [8, 30, 60, 14, 16, 16, 16, 16, 18, 12],
        function () {
          return porFilas(function (gd, f) {
            return [f.numero, A.nombreDe(gd.grupo), A.nombreDe(f.ambito), ent(Number(f.ambito.unidades) || 0)].concat(
              F.map(function (fa) { return euro(f.importes[fa.id]); }),
              [euro(f.total), euro(f.porUnidad), { v: aPct(f.total, d.total), s: E.pct }]);
          });
        },
        function () {
          return d.grupos.map(function (gd) {
            return [gd.numero, A.nombreDe(gd.grupo), '', ent(gd.sub.unidades)].concat(
              F.map(function (fa) { return euro(gd.sub.importes[fa.id]); }),
              [euro(gd.sub.total), '', { v: aPct(gd.sub.total, d.total), s: E.pct }]);
          });
        },
        ['', { v: 'Total', s: E.neg }, '', nEnt(d.unidades)].concat(
          F.map(function (fa) { return nEuro(d.porFase[fa.id]); }), [nEuro(d.total), '', { v: d.total ? 1 : 0, s: E.pctNeg }]));
    }

    /* Máximos */
    if (op.contenido.maximos) {
      var cabMax = ['Nº', 'Grupo', 'Ámbito'];
      F.forEach(function (f) { cabMax.push(f.nombre + ' · asistencias', f.nombre + ' · máximo'); });
      cabMax.push('Estado');
      var estado = function (n) { return n ? { v: n === 1 ? '1 fase supera el máximo' : n + ' fases superan el máximo', s: E.rojo } : 'Correcto'; };
      hojaDatos('Máximos', cabMax, [8, 30, 60, 14, 14, 14, 14, 14, 14, 26],
        function () {
          return porFilas(function (gd, f) {
            var fila = [f.numero, A.nombreDe(gd.grupo), A.nombreDe(f.ambito)];
            var n = 0;
            F.forEach(function (fa) {
              fila.push(ent(f.asist[fa.id]), f.max[fa.id] ? ent(f.max[fa.id]) : 'sin máximo');
              if (f.excede[fa.id]) { n++; }
            });
            fila.push(estado(n));
            return fila;
          });
        },
        function () {
          return d.grupos.map(function (gd) {
            var fila = [gd.numero, A.nombreDe(gd.grupo), ''];
            F.forEach(function (fa) { fila.push(ent(gd.sub.asist[fa.id]), gd.maxSub[fa.id] ? ent(gd.maxSub[fa.id]) : 'sin máximo'); });
            fila.push(estado(gd.excedidos));
            return fila;
          });
        },
        ['', { v: 'Total', s: E.neg }, ''].concat(
          (function () {
            var c = [];
            F.forEach(function (fa) {
              c.push(nEnt(d.grupos.reduce(function (t, gd) { return t + gd.sub.asist[fa.id]; }, 0)),
                nEnt(d.grupos.reduce(function (t, gd) { return t + gd.maxSub[fa.id]; }, 0)));
            });
            return c;
          })(), [d.excesos ? { v: d.excesos + ' superados', s: E.rojo } : { v: 'Correcto', s: E.neg }]));
    }

    /* Parámetros */
    if (op.contenido.config) {
      var filasCfg = [cab(['Nº', 'Grupo', 'Ámbito', 'Horas máx. por asistencia', 'Importe por hora', 'Importe asistencia', 'Unidades funcionales']
        .concat(F.map(function (f) { return 'Máx. asistencias · ' + f.nombre; })))];
      porFilas(function (gd, f) {
        var a = f.ambito;
        return [f.numero, A.nombreDe(gd.grupo), A.nombreDe(a), Number(a.horasMax) || 0, euro(Number(a.importeHora) || 0),
          euro(A.importeSesion(a)), ent(Number(a.unidades) || 0)].concat(F.map(function (fa) { return ent(f.max[fa.id]); }));
      }).forEach(function (fila) { filasCfg.push(fila); });
      hojas.push({
        nombre: 'Configuración', filas: filasCfg, anchos: [8, 30, 60, 16, 16, 16, 14, 16, 16, 16], congelar: 1,
        filtro: filasCfg.length > 1 ? 'A1:J' + filasCfg.length : null
      });
    }
    return hojas;
  }

  /* ---------- Informe (PDF) ---------- */

  function h(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function htmlInforme(d, op) {
    var A = App.asistencia;
    var F = A.FASES;
    var C = A.COLOR_FASE;
    var euro = App.ui.euro, num = App.ui.numero;
    var porAmbito = op.detalle === 'ambitos';
    var pct = function (p, t) { return t ? App.ui.porcentaje(p, t) : '—'; };

    function tabla(cabeceras, filas, pie) {
      return '<table><thead><tr>' + cabeceras.map(function (c, i) {
        return '<th' + (i > 0 ? ' class="n"' : '') + '>' + h(c) + '</th>';
      }).join('') + '</tr></thead><tbody>' + filas.join('') + '</tbody>' + (pie ? '<tfoot>' + pie + '</tfoot>' : '') + '</table>';
    }
    function tr(celdas, clase) {
      return '<tr' + (clase ? ' class="' + clase + '"' : '') + '>' + celdas.join('') + '</tr>';
    }
    function td(t, n, extra) { return '<td' + (n ? ' class="n"' : '') + (extra || '') + '>' + t + '</td>'; }
    function nombreGrupo(gd) { return '<b>' + h(gd.numero + ' ' + A.nombreDe(gd.grupo)) + '</b> <span class="sub">subtotal</span>'; }
    function nombreAmbito(f) { return '<span class="ind"><span class="num">' + h(f.numero) + '</span> ' + h(A.nombreDe(f.ambito)) + '</span>'; }
    function seccion(titulo, cuerpo, nota) {
      return '<section><h2>' + h(titulo) + '</h2>' + (nota ? '<p class="nota">' + h(nota) + '</p>' : '') + cuerpo + '</section>';
    }

    var partes = [];

    if (op.contenido.resumen) {
      var kpis = [
        ['Coste total', euro(d.total), 'Suma de los ámbitos incluidos'],
        ['Asistencias', num(d.asistencias), 'Entre las tres fases'],
        ['Coste medio por asistencia', d.asistencias ? euro(d.total / d.asistencias) : '—', 'Coste total ÷ asistencias'],
        ['Fase más cara', d.faseCara ? d.faseCara.nombre : '—', d.faseCara ? euro(d.porFase[d.faseCara.id]) + ' · ' + pct(d.porFase[d.faseCara.id], d.total) : 'Sin asistencias']
      ].map(function (k) {
        return '<div class="kpi"><span>' + h(k[0]) + '</span><b>' + h(k[1]) + '</b><small>' + h(k[2]) + '</small></div>';
      }).join('');
      var fasesFilas = F.map(function (fa) {
        var asis = d.grupos.reduce(function (t, gd) { return t + gd.sub.asist[fa.id]; }, 0);
        return tr([td('<span class="pto" style="background:' + C[fa.id] + '"></span>' + h(fa.nombre)), td(num(asis), true), td(euro(d.porFase[fa.id]), true), td(pct(d.porFase[fa.id], d.total), true)]);
      });
      partes.push(seccion('Resumen',
        '<div class="kpis">' + kpis + '</div>' +
        tabla(['Fase', 'Asistencias', 'Importe', '% del total'], fasesFilas,
          tr([td('Total'), td(num(d.asistencias), true), td(euro(d.total), true), td(d.total ? '100 %' : '—', true)]))));
    }

    if (op.contenido.asistencias) {
      var filas = [];
      d.grupos.forEach(function (gd) {
        filas.push(tr([td(nombreGrupo(gd)), td(num(gd.sub.unidades), true)].concat(
          F.map(function (fa) { return td(num(gd.sub.asist[fa.id]), true); }),
          [td(num(gd.sub.asistencias), true), td(euro(gd.sub.total), true)]), 'g'));
        if (porAmbito) {
          gd.filas.forEach(function (f) {
            filas.push(tr([td(nombreAmbito(f)), td(num(Number(f.ambito.unidades) || 0), true)].concat(
              F.map(function (fa) { return td(num(f.asist[fa.id]), true); }),
              [td(num(A.totalAsistencias(f.ambito)), true), td(euro(f.total), true)])));
          });
        }
      });
      partes.push(seccion('Asistencias por ámbito',
        tabla(['Grupo / ámbito', 'Unidades funcionales'].concat(F.map(function (f) { return f.nombre; }), ['Total asistencias', 'Importe total']), filas,
          tr([td('Total'), td(num(d.unidades), true)].concat(
            F.map(function (fa) { return td(num(d.grupos.reduce(function (t, gd) { return t + gd.sub.asist[fa.id]; }, 0)), true); }),
            [td(num(d.asistencias), true), td(euro(d.total), true)]))),
        'Importe total = importe por asistencia × asistencias × unidades funcionales.'));
    }

    if (op.contenido.desglose) {
      var filasD = [];
      d.grupos.forEach(function (gd) {
        filasD.push(tr([td(nombreGrupo(gd)), td(num(gd.sub.unidades), true)].concat(
          F.map(function (fa) { return td(euro(gd.sub.importes[fa.id]), true); }),
          [td(euro(gd.sub.total), true), td(''), td(pct(gd.sub.total, d.total), true)]), 'g'));
        if (porAmbito) {
          gd.filas.forEach(function (f) {
            filasD.push(tr([td(nombreAmbito(f)), td(num(Number(f.ambito.unidades) || 0), true)].concat(
              F.map(function (fa) { return td(euro(f.importes[fa.id]), true); }),
              [td(euro(f.total), true), td(euro(f.porUnidad), true), td(pct(f.total, d.total), true)])));
          });
        }
      });
      partes.push(seccion('Desglose de importes por ámbito y fase',
        tabla(['Grupo / ámbito', 'Unidades funcionales'].concat(F.map(function (f) { return f.nombre; }), ['Total', 'Coste por unidad funcional', '% del total']), filasD,
          tr([td('Total'), td(num(d.unidades), true)].concat(
            F.map(function (fa) { return td(euro(d.porFase[fa.id]), true); }),
            [td(euro(d.total), true), td(''), td(d.total ? '100 %' : '—', true)]))),
        'El coste por unidad funcional es lo que cuesta cada persona del ámbito.'));
    }

    if (op.contenido.grafica) {
      var max = 0;
      d.grupos.forEach(function (gd) {
        max = Math.max(max, gd.sub.total);
        if (porAmbito) { gd.filas.forEach(function (f) { max = Math.max(max, f.total); }); }
      });
      var leyenda = '<div class="leyenda">' + F.map(function (fa) {
        return '<span><span class="pto" style="background:' + C[fa.id] + '"></span>' + h(fa.nombre) + '</span>';
      }).join('') + '</div>';
      function barra(importes, total, etiqueta, clase) {
        return '<div class="barra ' + clase + '"><span class="et">' + etiqueta + '</span><div class="pista">' + F.map(function (fa) {
          return '<i style="width:' + (max ? importes[fa.id] / max * 100 : 0) + '%;background:' + C[fa.id] + '"></i>';
        }).join('') + '</div><b>' + h(euro(total)) + '</b></div>';
      }
      var barras = [];
      d.grupos.forEach(function (gd) {
        barras.push(barra(gd.sub.importes, gd.sub.total, h(gd.numero + ' ' + A.nombreDe(gd.grupo)), 'g'));
        if (porAmbito) { gd.filas.forEach(function (f) { barras.push(barra(f.importes, f.total, h(f.numero + ' ' + A.nombreDe(f.ambito)), '')); }); }
      });
      partes.push(seccion('Importe por ámbito, dividido por fases',
        max ? leyenda + barras.join('') : '<p class="nota">Sin importes que representar.</p>'));
    }

    if (op.contenido.maximos) {
      function celdaMax(n, m, fuera) {
        if (!m) { return td(num(n) + ' / sin máximo'); }
        return td('<span class="' + (n > m ? 'mal' : '') + '">' + num(n) + ' / ' + num(m) + '</span>' + (fuera ? ' <span class="aviso">' + h(fuera) + '</span>' : ''));
      }
      var filasM = [];
      d.grupos.forEach(function (gd) {
        filasM.push(tr([td(nombreGrupo(gd))].concat(F.map(function (fa) {
          var fuera = gd.filas.filter(function (f) { return f.excede[fa.id]; }).length;
          return celdaMax(gd.sub.asist[fa.id], gd.maxSub[fa.id], fuera ? fuera + (fuera === 1 ? ' ámbito supera' : ' ámbitos superan') : '');
        })), 'g'));
        if (porAmbito) {
          gd.filas.forEach(function (f) {
            filasM.push(tr([td(nombreAmbito(f))].concat(F.map(function (fa) {
              return celdaMax(f.asist[fa.id], f.max[fa.id], f.excede[fa.id] ? 'Supera el máximo' : '');
            }))));
          });
        }
      });
      var cabMax = ['Grupo / ámbito'].concat(F.map(function (f) { return f.nombre; }));
      partes.push(seccion('Asistencias frente al máximo',
        '<p class="' + (d.excesos ? 'mal' : 'bien') + '"><b>' + (d.excesos ? d.excesos + (d.excesos === 1 ? ' fase supera' : ' fases superan') + ' su máximo' : 'Todo dentro de los máximos') + '</b></p>' +
        tabla(cabMax, filasM), 'En cada grupo se suman las asistencias y los máximos de sus ámbitos.'));
    }

    if (op.contenido.config) {
      var filasC = [];
      d.grupos.forEach(function (gd) {
        filasC.push(tr([td('<b>' + h(gd.numero + ' ' + A.nombreDe(gd.grupo)) + '</b>')].concat([td(''), td(''), td(''), td('')], F.map(function () { return td(''); })), 'g'));
        gd.filas.forEach(function (f) {
          var a = f.ambito;
          filasC.push(tr([td(nombreAmbito(f)), td(num(Number(a.horasMax) || 0), true), td(euro(Number(a.importeHora) || 0), true),
            td(euro(A.importeSesion(a)), true), td(num(Number(a.unidades) || 0), true)].concat(F.map(function (fa) { return td(num(f.max[fa.id]), true); }))));
        });
      });
      partes.push(seccion('Parámetros de configuración',
        tabla(['Grupo / ámbito', 'Horas máx. por asistencia', 'Importe por hora', 'Importe asistencia', 'Unidades funcionales'].concat(F.map(function (f) { return 'Máx. · ' + f.nombre; })), filasC)));
    }

    var css = '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}' +
      'body{font:11px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#191c21;margin:0;padding:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'header.cab{border-bottom:2px solid #00346f;padding-bottom:8px;margin-bottom:14px}h1{font-size:20px;margin:0;color:#00346f}' +
      '.meta{color:#424751;margin:2px 0}.notas{margin-top:6px;padding:6px 10px;background:#f3f3fa;border-radius:4px;white-space:pre-wrap}' +
      'section{margin-bottom:16px}h2{font-size:14px;color:#00346f;margin:0 0 6px;break-after:avoid}.nota{color:#737783;margin:0 0 6px;font-size:10px}' +
      '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.kpi{border:1px solid #c2c6d3;border-radius:4px;padding:8px 10px;display:flex;flex-direction:column}' +
      '.kpi span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#737783}.kpi b{font-size:16px;color:#00346f}.kpi small{color:#424751}' +
      'table{width:100%;border-collapse:collapse;font-size:10px}th{background:#f3f3fa;text-align:left;padding:5px 6px;border-bottom:1px solid #c2c6d3;font-size:9px;text-transform:uppercase;letter-spacing:.04em}' +
      'td{padding:4px 6px;border-bottom:1px solid #e6e7ee;vertical-align:top}.n{text-align:right;font-variant-numeric:tabular-nums}th.n{text-align:right}' +
      'tr.g td{background:#ededf5;border-bottom:1px solid #c2c6d3}.sub{font-weight:400;color:#737783;font-size:9px}.ind{padding-left:14px;display:block}.num{color:#737783}' +
      'tfoot td{font-weight:700;border-top:2px solid #c2c6d3;background:#f3f3fa}tr{break-inside:avoid}thead{display:table-header-group}' +
      '.pto{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}.leyenda{display:flex;gap:14px;margin-bottom:6px}' +
      '.barra{display:grid;grid-template-columns:260px 1fr 90px;gap:8px;align-items:center;margin:3px 0;break-inside:avoid}.barra.g{margin-top:8px;font-weight:700}' +
      '.barra .et{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.barra:not(.g) .et{padding-left:14px;font-size:10px}' +
      '.pista{display:flex;height:11px;background:#f3f3fa;border-radius:2px;overflow:hidden}.pista i{display:block;height:100%}.barra b{text-align:right}' +
      '.mal{color:#ba1a1a;font-weight:700}.bien{color:#0f7a3d}.aviso{background:#ffdad6;color:#ba1a1a;border-radius:8px;padding:0 6px;font-size:9px}' +
      'footer{margin-top:10px;color:#737783;font-size:9px;border-top:1px solid #e6e7ee;padding-top:4px}' +
      '.pantalla{position:fixed;top:10px;right:10px}.pantalla button{font:inherit;padding:8px 14px;border:0;border-radius:4px;background:#00346f;color:#fff;cursor:pointer}' +
      '@media print{.pantalla{display:none}body{padding:0}}';

    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + h(d.titulo) + '</title><style>' + css + '</style></head><body>' +
      '<div class="pantalla"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>' +
      '<header class="cab"><h1>' + h(d.titulo) + '</h1>' +
      '<p class="meta">' + h((d.convocatoria ? d.convocatoria + ' · ' : '') + 'Importe por asistencia · Generado el ' + App.ui.fecha(d.fecha)) + '</p>' +
      '<p class="meta">Grupos incluidos: ' + h(d.todosLosGrupos ? 'todos' : d.nombresGrupos.join('; ')) + ' · Detalle: ' + (porAmbito ? 'cada ámbito' : 'sólo subtotales por grupo') + '</p>' +
      (op.notas ? '<div class="notas">' + h(op.notas) + '</div>' : '') + '</header>' +
      partes.join('') +
      '<footer>Gestión Electoral — Importe por asistencia</footer>' +
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},500)})<\/script>' +
      '</body></html>';
  }

  /* ---------- Salida ---------- */

  function nombreBase(d) {
    var f = d.fecha;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'asistencia-' + f.getFullYear() + p(f.getMonth() + 1) + p(f.getDate());
  }

  function sacarExcel(d, op) {
    var bytes = X.libro(hojasExcel(d, op));
    App.ui.descargarBinario(nombreBase(d) + '.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  /* El informe se abre en una pestaña propia, desde la que se imprime o se
     guarda como PDF; funciona igual dentro de la vista previa y en producción. */
  function sacarPDF(d, op) {
    var html = htmlInforme(d, op);
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    var ventana = window.open(url, '_blank');
    if (ventana) {
      setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
      return true;
    }
    URL.revokeObjectURL(url);
    App.ui.descargar(nombreBase(d) + '.html', html, 'text/html');
    App.ui.flotante('El navegador bloqueó la ventana. Se ha descargado el informe en HTML: ábralo y use Imprimir → Guardar como PDF.', true);
    return false;
  }

  /* ---------- Cuadro de exportación ---------- */

  function casilla(texto, nota, marcada, alCambiar) {
    return el('label', { class: 'opcion-check' }, [
      el('input', { type: 'checkbox', checked: marcada, onChange: function (e) { alCambiar(e.target.checked); } }),
      el('span', { class: 'texto', text: texto }),
      nota ? el('span', { class: 'meta', text: nota }) : null
    ]);
  }

  function radio(nombre, valor, texto, activo, alCambiar) {
    return el('label', { class: 'opcion-check' }, [
      el('input', { type: 'radio', name: nombre, checked: activo, onChange: function () { alCambiar(valor); } }),
      el('span', { class: 'texto', text: texto })
    ]);
  }

  function exportar() {
    var A = App.asistencia;
    var op = leerPrefs();

    var titulo = el('input', {
      type: 'text', value: op.titulo, placeholder: 'Informe de asistencias', 'aria-label': 'Título del informe',
      onInput: function (e) { op.titulo = e.target.value; }
    });
    var notas = el('textarea', {
      rows: '2', placeholder: 'Opcional: se escribe tal cual en el informe', 'aria-label': 'Notas',
      onInput: function (e) { op.notas = e.target.value; }
    });

    var contenido = el('div', { class: 'lista-check' }, CONTENIDOS.map(function (c) {
      return casilla(c.nombre, c.nota, op.contenido[c.id], function (v) { op.contenido[c.id] = v; });
    }));
    var listaGrupos = el('div', { class: 'lista-check' }, A.grupos().map(function (g, gi) {
      return casilla(A.numeroGrupo(gi) + ' ' + A.nombreDe(g), g.ambitos.length + (g.ambitos.length === 1 ? ' ámbito' : ' ámbitos'),
        op.grupos.indexOf(g.id) >= 0, function (v) {
          var i = op.grupos.indexOf(g.id);
          if (v && i < 0) { op.grupos.push(g.id); }
          if (!v && i >= 0) { op.grupos.splice(i, 1); }
        });
    }));
    var detalle = el('div', { class: 'lista-check' }, [
      radio('detalle', 'ambitos', 'Cada ámbito, con el subtotal de su grupo', op.detalle === 'ambitos', function (v) { op.detalle = v; }),
      radio('detalle', 'grupos', 'Sólo subtotales por grupo (informe más corto)', op.detalle === 'grupos', function (v) { op.detalle = v; })
    ]);
    var formato = el('div', { class: 'lista-check' }, [
      radio('formato', 'excel', 'Excel (.xlsx)', op.formato === 'excel', function (v) { op.formato = v; }),
      radio('formato', 'pdf', 'PDF (informe para imprimir)', op.formato === 'pdf', function (v) { op.formato = v; }),
      radio('formato', 'ambos', 'Excel y PDF', op.formato === 'ambos', function (v) { op.formato = v; })
    ]);

    function bloque(titulo1, nodo) {
      return el('div', { class: 'bloque-export' }, [el('strong', { text: titulo1 }), nodo]);
    }

    var form = el('div', { class: 'apilar', style: 'gap:16px;margin-top:4px' }, [
      bloque('Qué incluir', contenido),
      el('div', { class: 'rejilla-export' }, [bloque('Grupos', listaGrupos), el('div', { class: 'apilar', style: 'gap:16px' }, [bloque('Detalle', detalle), bloque('Formato', formato)])]),
      bloque('Título', titulo),
      bloque('Notas', notas)
    ]);

    App.ui.confirmar({
      titulo: 'Exportar asistencias',
      parrafos: ['Elija qué quiere sacar. La gráfica sólo aparece en el PDF; el Excel lleva una hoja por bloque.'],
      contenido: form,
      ancho: true,
      textoConfirmar: 'Exportar',
      validar: function () {
        var alguno = CONTENIDOS.some(function (c) { return op.contenido[c.id]; });
        if (!alguno) { App.ui.flotante('Marque al menos un bloque para exportar.', true); return false; }
        if (!op.grupos.length) { App.ui.flotante('Marque al menos un grupo.', true); return false; }
        if (op.formato === 'excel' && !CONTENIDOS.some(function (c) { return c.id !== 'grafica' && op.contenido[c.id]; })) {
          App.ui.flotante('La gráfica sólo existe en el PDF: marque otro bloque o elija PDF.', true);
          return false;
        }
        return true;
      },
      alConfirmar: function () {
        guardarPrefs(op);
        var d = modelo(op);
        var hecho = [];
        if (op.formato !== 'pdf') { sacarExcel(d, op); hecho.push('Excel'); }
        if (op.formato !== 'excel') { if (sacarPDF(d, op)) { hecho.push('informe PDF'); } }
        if (hecho.length) { App.ui.flotante('Generado: ' + hecho.join(' y ') + '.'); }
      }
    });
  }

  App.asistencia.exportar = exportar;
  App.asistencia.modeloExport = modelo;
  App.asistencia.hojasExcel = hojasExcel;
  App.asistencia.htmlInforme = htmlInforme;
})(window.App = window.App || {});
