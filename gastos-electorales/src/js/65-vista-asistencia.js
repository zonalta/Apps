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
      style: sufijo && sufijo.length > 2 ? 'padding-right:56px' : null,
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

  /* Importe total de un ámbito: importe por sesión × asistencias × unidades
     funcionales (cada unidad es una persona y cobra su sesión). */
  function importeTotal(ambito) {
    return importeSesion(ambito) * totalAsistencias(ambito) * (Number(ambito.unidades) || 0);
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
      el('header', {}, [el('h2', {}, [icono('mesa'), 'Máximo de asistencias por fase'])]),
      el('p', {
        class: 'silencio',
        text: 'Número máximo de asistencias que puede realizar cada ámbito en cada fase. Los ámbitos se gestionan en el bloque de arriba.'
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
                ].concat(FASES.map(function (f) { return celdaNumero(a, f.id, 'asist.', '1', true); })));
              }))
            ])
          ])
        : el('p', { class: 'sin-datos', text: 'Añada primero algún ámbito de actuación.' })
    ]);
  }

  /* ---------- Análisis del Dashboard ---------- */

  /* Un color por fase. Los tres se distinguen también por la leyenda y por
     el importe que sale al pasar el ratón, no sólo por el tono. */
  var COLOR_FASE = { previa: '#255dad', electoral: '#1b8a8a', cierre: '#c98a2b' };

  /* Importe de un ámbito en una fase: importe sesión × asistencias × unidades. */
  function importeFase(ambito, fase) {
    return importeSesion(ambito) * (Number(asistenciasDe(ambito)[fase]) || 0) * (Number(ambito.unidades) || 0);
  }

  function datosAnalisis(ambitos) {
    var porFase = { previa: 0, electoral: 0, cierre: 0 };
    var filas = ambitos.map(function (a) {
      var imp = {};
      FASES.forEach(function (f) { imp[f.id] = importeFase(a, f.id); porFase[f.id] += imp[f.id]; });
      return {
        ambito: a, importes: imp,
        total: importeTotal(a),
        porUnidad: importeSesion(a) * totalAsistencias(a)
      };
    });
    var total = filas.reduce(function (t, f) { return t + f.total; }, 0);
    var asistencias = ambitos.reduce(function (t, a) { return t + totalAsistencias(a); }, 0);
    return { filas: filas, porFase: porFase, total: total, asistencias: asistencias };
  }

  function pct(parte, total) { return total ? App.ui.porcentaje(parte, total) : '—'; }

  function leyendaFases() {
    return el('div', { class: 'fila', style: 'gap:16px;margin-bottom:12px' }, FASES.map(function (f) {
      return el('span', { class: 'fila', style: 'gap:6px;font-size:12px' }, [
        el('span', { style: 'width:12px;height:12px;border-radius:2px;background:' + COLOR_FASE[f.id] }),
        f.nombre
      ]);
    }));
  }

  function indicadores(d) {
    var fases = FASES.slice().sort(function (a, b) { return d.porFase[b.id] - d.porFase[a.id]; });
    var cara = fases[0];

    function tarjeta(etiqueta, valor, nota, destacado) {
      return el('div', { class: 'tarjeta kpi' }, [
        el('span', { class: 'etiqueta', text: etiqueta }),
        el('span', { class: 'valor num' + (destacado ? ' destacado' : ''), text: valor }),
        el('span', { class: 'nota', text: nota })
      ]);
    }

    return el('div', { class: 'rejilla cuatro' }, [
      tarjeta('Coste total', App.ui.euro(d.total), 'Suma de todos los ámbitos', true),
      tarjeta('Asistencias', App.ui.numero(d.asistencias), 'Entre las tres fases'),
      tarjeta('Coste medio por asistencia', d.asistencias ? App.ui.euro(d.total / d.asistencias) : '—', 'Coste total ÷ asistencias'),
      tarjeta('Fase más cara', d.total ? cara.nombre : '—',
        d.total ? App.ui.euro(d.porFase[cara.id]) + ' · ' + pct(d.porFase[cara.id], d.total) + ' del total' : 'Sin asistencias cargadas')
    ]);
  }

  function tablaDesglose(d) {
    var cuerpo = d.filas.map(function (f) {
      return el('tr', {}, [
        el('td', { style: 'white-space:normal;min-width:200px', text: f.ambito.nombre || '(ámbito sin nombre)' }),
        el('td', { class: 'n', text: App.ui.numero(Number(f.ambito.unidades) || 0) })
      ].concat(
        FASES.map(function (fa) { return el('td', { class: 'n', text: App.ui.euro(f.importes[fa.id]) }); }),
        [
          el('td', { class: 'n', style: 'font-weight:600', text: App.ui.euro(f.total) }),
          el('td', { class: 'n', text: App.ui.euro(f.porUnidad) }),
          el('td', { class: 'n', text: pct(f.total, d.total) })
        ]
      ));
    });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('euro'), 'Desglose de importes por ámbito y fase'])]),
      el('p', {
        class: 'silencio',
        text: 'Importe de cada fase (importe por sesión × asistencias × unidades funcionales) y lo que cuesta cada unidad funcional, es decir, cada persona del ámbito.'
      }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Ámbito de actuación' }),
            el('th', { class: 'n', style: 'white-space:normal', text: 'Unidades funcionales' })
          ].concat(
            FASES.map(function (f) { return el('th', { class: 'n', text: f.nombre }); }),
            [
              el('th', { class: 'n', text: 'Total ámbito' }),
              el('th', { class: 'n', style: 'white-space:normal', text: 'Coste por unidad funcional' }),
              el('th', { class: 'n', text: '% del total' })
            ]
          ))]),
          el('tbody', {}, cuerpo),
          el('tfoot', {}, [el('tr', {}, [el('td', { text: 'Total' }), el('td', {})].concat(
            FASES.map(function (f) { return el('td', { class: 'n', text: App.ui.euro(d.porFase[f.id]) }); }),
            [el('td', { class: 'n', text: App.ui.euro(d.total) }), el('td', {}), el('td', { class: 'n', text: d.total ? '100 %' : '—' })]
          ))])
        ])
      ])
    ]);
  }

  function graficaApilada(d) {
    var max = d.filas.reduce(function (m, f) { return Math.max(m, f.total); }, 0);
    var contenido;
    if (!max) {
      contenido = el('p', { class: 'gr-vacia', text: 'Sin importes que representar: introduzca asistencias.' });
    } else {
      contenido = el('div', { class: 'gr-barras' }, d.filas.map(function (f) {
        var nombre = f.ambito.nombre || '(ámbito sin nombre)';
        return el('div', { class: 'gr-fila' }, [
          el('span', { class: 'gr-etiqueta', title: nombre, text: nombre }),
          el('div', { class: 'gr-pista', style: 'display:flex' }, FASES.map(function (fa) {
            var v = f.importes[fa.id];
            return el('div', {
              title: fa.nombre + ': ' + App.ui.euro(v),
              style: 'height:100%;width:' + (v / max * 100) + '%;background:' + COLOR_FASE[fa.id]
            });
          })),
          el('span', { class: 'gr-valor', text: App.ui.euro(f.total) })
        ]);
      }));
    }
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', { text: 'Importe por ámbito, dividido por fases' })]),
      leyendaFases(),
      contenido
    ]);
  }

  /* Asistencias frente al máximo de asistencias configurado. Sin máximo (0) no se
     juzga: se muestra el dato sin barra. Por encima del máximo se marca en rojo. */
  function ocupacion(ambitos) {
    function celda(ambito, fase) {
      var n = Number(asistenciasDe(ambito)[fase]) || 0;
      var m = Number(sesionesDe(ambito)[fase]) || 0;
      if (!m) {
        return el('td', {}, [el('span', { class: 'silencio', text: n + ' / sin máximo' })]);
      }
      var excede = n > m;
      return el('td', {}, [
        el('div', { style: 'display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:4px' }, [
          el('span', { class: 'num', style: excede ? 'color:var(--error);font-weight:600' : '', text: n + ' / ' + m }),
          excede ? el('span', { class: 'chip', style: 'background:var(--error-container);color:var(--error)', text: 'Supera el máximo' }) : null
        ]),
        el('div', { class: 'gr-pista', style: 'height:8px' }, [
          el('div', {
            class: 'gr-barra',
            style: 'width:' + Math.min(100, n / m * 100) + '%;background:' + (excede ? 'var(--error)' : COLOR_FASE[fase])
          })
        ])
      ]);
    }

    var excesos = 0;
    ambitos.forEach(function (a) {
      FASES.forEach(function (f) {
        var m = Number(sesionesDe(a)[f.id]) || 0;
        if (m && (Number(asistenciasDe(a)[f.id]) || 0) > m) { excesos++; }
      });
    });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', { text: 'Asistencias frente al máximo' }),
        excesos
          ? el('span', { class: 'chip', style: 'background:var(--error-container);color:var(--error)', text: excesos + (excesos === 1 ? ' fase supera' : ' fases superan') + ' su máximo' })
          : el('span', { class: 'chip ok', text: 'Todo dentro de los máximos' })
      ]),
      el('p', { class: 'silencio', text: 'Máximos definidos en Configuración de Asistencia.' }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [el('th', { text: 'Ámbito de actuación' })].concat(
            FASES.map(function (f) { return el('th', { text: f.nombre }); })
          ))]),
          el('tbody', {}, ambitos.map(function (a) {
            return el('tr', {}, [
              el('td', { style: 'white-space:normal;min-width:200px', text: a.nombre || '(ámbito sin nombre)' })
            ].concat(FASES.map(function (f) { return celda(a, f.id); })));
          }))
        ])
      ])
    ]);
  }

  /* Se repinta entero cada vez que cambia una asistencia: son pocas filas. */
  function pintarAnalisis(contenedor, ambitos) {
    var d = datosAnalisis(ambitos);
    App.ui.vaciar(contenedor);
    [indicadores(d), tablaDesglose(d), graficaApilada(d), ocupacion(ambitos)].forEach(function (n) {
      contenedor.appendChild(n);
    });
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

    var analisis = el('div', { class: 'apilar', style: 'gap:24px' });
    function pieTotales() {
      var tAsis = 0, tImp = 0, tUni = 0;
      ambitos.forEach(function (a) {
        tAsis += totalAsistencias(a);
        tImp += importeTotal(a);
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
      pintarAnalisis(analisis, ambitos);
    }

    var filas = ambitos.map(function (a) {
      var celdaTotal = el('td', { class: 'n', style: 'font-weight:600' });
      var celdaImporte = el('td', { class: 'n', style: 'font-weight:600' });
      function actualizar() {
        celdaTotal.textContent = App.ui.numero(totalAsistencias(a));
        celdaImporte.textContent = App.ui.euro(importeTotal(a));
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

    var tarjetaTabla = el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('dashboard'), 'Asistencias por ámbito'])]),
      el('p', {
        class: 'silencio',
        text: 'Introduzca las asistencias de cada ámbito en cada fase. El importe total es el importe por sesión de cada ámbito (Configuración) multiplicado por su total de asistencias y por sus unidades funcionales.'
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

    return el('div', { class: 'apilar', style: 'gap:24px' }, [tarjetaTabla, analisis]);
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
