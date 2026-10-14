/* Módulo "Importe por asistencia". Por ahora sólo tiene la configuración de
   los ámbitos de actuación; el dashboard sigue pendiente de definir. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  /* Las tres fases del proceso, en orden. */
  var FASES = [
    { id: 'previa', nombre: 'Fase previa' },
    { id: 'electoral', nombre: 'Periodo electoral' },
    { id: 'cierre', nombre: 'Fase de cierre' }
  ];

  /* Los ámbitos guardados antes de existir las fases no traen maxSesiones. */
  function sesionesDe(ambito) {
    if (!ambito.maxSesiones) { ambito.maxSesiones = { previa: 0, electoral: 0, cierre: 0 }; }
    return ambito.maxSesiones;
  }

  /* Asistencias realizadas por fase (se introducen en el Dashboard). */
  function asistenciasDe(ambito) {
    if (!ambito.asistencias) { ambito.asistencias = { previa: 0, electoral: 0, cierre: 0 }; }
    return ambito.asistencias;
  }

  function totalAsistencias(ambito) {
    var a = asistenciasDe(ambito);
    return FASES.reduce(function (t, f) { return t + (Number(a[f.id]) || 0); }, 0);
  }

  /* Campo numérico de una celda de la tabla, con su unidad al final. */
  function celdaNumero(ambito, clave, sufijo, paso, destino, alCambiar) {
    var obj = destino ? sesionesDe(ambito) : ambito;
    var input = el('input', {
      type: 'number', min: '0', step: paso || '0.01',
      value: obj[clave],
      'aria-label': clave + ' — ' + ambito.nombre,
      onInput: function (e) {
        var v = parseFloat(e.target.value);
        App.store.muta(function () { obj[clave] = isNaN(v) ? 0 : v; });
        if (alCambiar) { alCambiar(); }
      }
    });
    var cont = el('div', {
      class: 'campo-euro' + (sufijo ? '' : ' sin'),
      'data-sufijo': sufijo || null
    }, [input]);
    return el('td', {}, [cont]);
  }

  function ambitoNuevo() {
    var ids = App.store.estado().asistencia.ambitos.map(function (a) { return Number(String(a.id).slice(1)) || 0; });
    return { id: 'a' + (Math.max.apply(null, ids.concat([0])) + 1), nombre: '', horasMax: 0, importeHora: 0, unidades: 0, maxSesiones: { previa: 0, electoral: 0, cierre: 0 }, asistencias: { previa: 0, electoral: 0, cierre: 0 } };
  }

  function quitar(ambito) {
    App.ui.confirmar({
      titulo: 'Quitar el ámbito',
      parrafos: ['Se quitará «' + (ambito.nombre || 'ámbito sin nombre') + '» de la configuración.'],
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: function () {
        App.store.muta(function (s) {
          s.asistencia.ambitos = s.asistencia.ambitos.filter(function (a) { return a !== ambito; });
        });
        App.render();
      }
    });
  }

  /* Importe de una sesión: horas máximas × importe por hora. No se edita; se
     recalcula al escribir en cualquiera de los dos campos. */
  function importeSesion(ambito) {
    return (Number(ambito.horasMax) || 0) * (Number(ambito.importeHora) || 0);
  }

  function fila(ambito) {
    var celdaImporte = el('td', { class: 'n num', style: 'font-weight:600', text: App.ui.euro(importeSesion(ambito)) });
    function recalcular() { celdaImporte.textContent = App.ui.euro(importeSesion(ambito)); }

    return el('tr', {}, [
      el('td', { style: 'min-width:260px;width:36%;white-space:normal' }, [
        el('textarea', {
          rows: '2', text: ambito.nombre, placeholder: 'Nombre del ámbito',
          style: 'width:100%;font:inherit;padding:9px 12px;border:1px solid var(--outline);border-radius:var(--radio);resize:vertical',
          'aria-label': 'Nombre del ámbito',
          onInput: function (e) {
            var v = e.target.value;
            App.store.muta(function () { ambito.nombre = v; });
          }
        })
      ]),
      celdaNumero(ambito, 'horasMax', 'h.', null, false, recalcular),
      celdaNumero(ambito, 'importeHora', '€', null, false, recalcular),
      celdaImporte,
      celdaNumero(ambito, 'unidades', '', '1'),
      el('td', {}, [
        el('button', {
          class: 'btn peligro pequeno', 'aria-label': 'Quitar ámbito',
          onClick: function () { quitar(ambito); }
        }, [icono('papelera', 14)])
      ])
    ]);
  }

  function tarjetaAmbitos() {
    var ambitos = App.store.estado().asistencia.ambitos;
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('documento'), 'Ámbitos de actuación']),
        el('button', {
          class: 'btn secundario pequeno',
          onClick: function () {
            App.store.muta(function (s) { s.asistencia.ambitos.push(ambitoNuevo()); });
            App.render();
          }
        }, 'Añadir ámbito')
      ]),
      el('p', {
        class: 'silencio',
        text: 'Para cada ámbito: las horas máximas de una asistencia, el importe por hora y el número de unidades funcionales (personas).'
      }),
      ambitos.length
        ? el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
            el('table', {}, [
              el('thead', {}, [el('tr', {}, [
                el('th', { text: 'Ámbito de actuación' }),
                el('th', { text: 'Horas máx. por asistencia' }),
                el('th', { text: 'Importe por hora' }),
                el('th', { class: 'n', text: 'Importe sesión' }),
                el('th', { text: 'Unidades funcionales' }),
                el('th', {})
              ])]),
              el('tbody', {}, ambitos.map(fila))
            ])
          ])
        : el('p', { class: 'sin-datos', text: 'No hay ámbitos. Añada el primero.' })
    ]);
  }

  function tarjetaSesiones() {
    var ambitos = App.store.estado().asistencia.ambitos;
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('mesa'), 'Máximo de sesiones por fase'])]),
      el('p', {
        class: 'silencio',
        text: 'Número máximo de sesiones de asistencia que puede realizar cada ámbito en cada fase. Los ámbitos se gestionan en el bloque de arriba.'
      }),
      ambitos.length
        ? el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
            el('table', {}, [
              el('thead', {}, [el('tr', {}, [el('th', { text: 'Ámbito de actuación' })].concat(
                FASES.map(function (f) { return el('th', { text: f.nombre }); })
              ))]),
              el('tbody', {}, ambitos.map(function (a) {
                return el('tr', {}, [
                  el('td', { style: 'white-space:normal;min-width:200px;width:30%', text: a.nombre || '(ámbito sin nombre)' })
                ].concat(FASES.map(function (f) { return celdaNumero(a, f.id, 'ses.', '1', true); })));
              }))
            ])
          ])
        : el('p', { class: 'sin-datos', text: 'Añada primero algún ámbito de actuación.' })
    ]);
  }

  App.vistas = App.vistas || {};

  /* Dashboard: una fila por ámbito con sus asistencias por fase, el total y el
     importe (importe sesión × total de asistencias). Los totales se recalculan
     al escribir, sin repintar la tabla. */
  function tarjetaDashboard() {
    var ambitos = App.store.estado().asistencia.ambitos;
    if (!ambitos.length) {
      return el('section', { class: 'tarjeta' }, [
        el('p', { class: 'sin-datos', text: 'No hay ámbitos. Añádalos en Configuración de Asistencia.' })
      ]);
    }

    var actualizadores = [];
    function pieTotales() {
      var tAsis = 0, tImp = 0, tUni = 0;
      ambitos.forEach(function (a) {
        tAsis += totalAsistencias(a);
        tImp += totalAsistencias(a) * importeSesion(a);
        tUni += Number(a.unidades) || 0;
      });
      return { asis: tAsis, imp: tImp, uni: tUni };
    }

    var celdaPieUni = el('td', { class: 'n' });
    var celdaPieAsis = el('td', { class: 'n' });
    var celdaPieImp = el('td', { class: 'n' });
    var celdasPieFase = FASES.map(function () { return el('td', { class: 'n' }); });

    function actualizarPie() {
      var t = pieTotales();
      celdaPieUni.textContent = App.ui.numero(t.uni);
      celdaPieAsis.textContent = App.ui.numero(t.asis);
      celdaPieImp.textContent = App.ui.euro(t.imp);
      FASES.forEach(function (f, i) {
        celdasPieFase[i].textContent = App.ui.numero(ambitos.reduce(function (s, a) {
          return s + (Number(asistenciasDe(a)[f.id]) || 0);
        }, 0));
      });
    }

    var filas = ambitos.map(function (a) {
      var celdaTotal = el('td', { class: 'n', style: 'font-weight:600' });
      var celdaImporte = el('td', { class: 'n', style: 'font-weight:600' });
      function actualizar() {
        celdaTotal.textContent = App.ui.numero(totalAsistencias(a));
        celdaImporte.textContent = App.ui.euro(totalAsistencias(a) * importeSesion(a));
      }
      actualizar();

      var celdasFase = FASES.map(function (f) {
        return el('td', {}, [el('input', {
          type: 'number', min: '0', step: '1', style: 'width:76px',
          value: asistenciasDe(a)[f.id],
          'aria-label': f.nombre + ' — ' + a.nombre,
          onInput: function (e) {
            var v = parseFloat(e.target.value);
            App.store.muta(function () { asistenciasDe(a)[f.id] = isNaN(v) ? 0 : v; });
            actualizar();
            actualizarPie();
          }
        })]);
      });

      return el('tr', {}, [
        el('td', { style: 'white-space:normal;min-width:200px;width:30%', text: a.nombre || '(ámbito sin nombre)' }),
        el('td', { class: 'n', text: App.ui.numero(Number(a.unidades) || 0) })
      ].concat(celdasFase, [celdaTotal, celdaImporte]));
    });
    actualizarPie();

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('dashboard'), 'Asistencias por ámbito'])]),
      el('p', {
        class: 'silencio',
        text: 'Introduzca las asistencias de cada ámbito en cada fase. El importe total es el importe por sesión de cada ámbito (Configuración) multiplicado por su total de asistencias.'
      }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Ámbito de actuación' }),
            el('th', { class: 'n', style: 'white-space:normal', text: 'Unidades funcionales' })
          ].concat(
            FASES.map(function (f) { return el('th', { class: 'n', text: f.nombre }); }),
            [el('th', { class: 'n', style: 'white-space:normal', text: 'Total asistencias' }), el('th', { class: 'n', text: 'Importe total' })]
          ))]),
          el('tbody', {}, filas),
          el('tfoot', {}, [el('tr', {}, [el('td', { text: 'Total' }), celdaPieUni].concat(celdasPieFase, [celdaPieAsis, celdaPieImp]))])
        ])
      ])
    ]);
  }

  App.vistas['asistencia-dashboard'] = {
    titulo: 'Dashboard de Asistencia',
    subtitulo: 'Asistencias realizadas por ámbito y fase, y su importe. Los cambios se guardan al instante.',
    render: function () { return tarjetaDashboard(); }
  };

  App.vistas['asistencia-config'] = {
    titulo: 'Configuración de Asistencia',
    subtitulo: 'Valores e importes de cada ámbito. Los cambios se guardan al instante.',
    render: function () {
      return el('div', { class: 'apilar', style: 'gap:24px' }, [tarjetaAmbitos(), tarjetaSesiones()]);
    }
  };
})(window.App = window.App || {});
