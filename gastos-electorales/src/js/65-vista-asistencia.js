/* Módulo "Importe por asistencia". Por ahora sólo tiene la configuración de
   los ámbitos de actuación; el dashboard sigue pendiente de definir. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  /* Las tres fases del proceso, en orden. */
  var FASES = [
    { id: 'previa', nombre: 'Fase previa' },
    { id: 'electoral', nombre: 'Fase electoral' },
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

  /* ---------- Grupos y acordeón ---------- */

  /* Los grupos sólo clasifican: no llevan datos. Su número (1, 2…) y el de sus
     ámbitos (1.1, 1.2…) salen de la posición. */
  function grupos() { return App.store.estado().asistencia.grupos; }
  function numeroAmbito(gi, ai) { return (gi + 1) + '.' + (ai + 1) + '.'; }
  function numeroGrupo(gi) { return (gi + 1) + '.'; }
  function nombreDe(x) { return x.nombre || '(sin nombre)'; }
  function todosLosAmbitos() {
    return grupos().reduce(function (t, g) { return t.concat(g.ambitos); }, []);
  }

  /* Qué grupos están contraídos. Es sólo de pantalla: no se guarda. Cada
     vista tiene el suyo; la configuración comparte uno entre sus dos bloques
     y el dashboard otro entre todos los suyos. */
  var plegado = { config: {}, dash: {} };

  function botonGrupo(vista, g, texto) {
    var cerrado = !!plegado[vista][g.id];
    return el('button', {
      type: 'button', class: 'grupo-toggle',
      'aria-expanded': String(!cerrado),
      'aria-label': (cerrado ? 'Expandir' : 'Contraer') + ' ' + texto,
      onClick: function () { plegado[vista][g.id] = !cerrado; App.render(); }
    }, [el('span', { class: 'chev', 'aria-hidden': 'true', text: cerrado ? '▸' : '▾' }), texto]);
  }

  function visibles(vista, g) { return plegado[vista][g.id] ? [] : g.ambitos; }

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
    var ids = todosLosAmbitos().map(function (a) { return Number(String(a.id).replace(/\D/g, '')) || 0; });
    return {
      id: 'a' + (Math.max.apply(null, ids.concat([0])) + 1), nombre: '',
      horasMax: 0, importeHora: 0, unidades: 0,
      maxSesiones: { previa: 0, electoral: 0, cierre: 0 }, asistencias: { previa: 0, electoral: 0, cierre: 0 }
    };
  }

  function grupoNuevo() {
    var ids = grupos().map(function (g) { return Number(String(g.id).replace(/\D/g, '')) || 0; });
    return { id: 'g' + (Math.max.apply(null, ids.concat([0])) + 1), nombre: '', ambitos: [] };
  }

  function quitarAmbito(grupo, ambito) {
    App.ui.confirmar({
      titulo: 'Quitar el ámbito',
      parrafos: ['Se quitará «' + nombreDe(ambito) + '» de la configuración, con sus datos.'],
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: function () {
        App.store.muta(function () { grupo.ambitos = grupo.ambitos.filter(function (a) { return a !== ambito; }); });
        App.render();
      }
    });
  }

  function quitarGrupo(grupo) {
    var n = grupo.ambitos.length;
    App.ui.confirmar({
      titulo: 'Quitar el grupo',
      parrafos: [
        'Se quitará el grupo «' + nombreDe(grupo) + '»' +
          (n ? ' y sus ' + n + (n === 1 ? ' ámbito' : ' ámbitos') + ', con todos sus datos.' : '.')
      ],
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: function () {
        App.store.muta(function (st) { st.asistencia.grupos = st.asistencia.grupos.filter(function (g) { return g !== grupo; }); });
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

  function fila(grupo, ambito, gi, ai) {
    var celdaImporte = el('td', { class: 'n num', style: 'font-weight:600', text: App.ui.euro(importeSesion(ambito)) });
    function recalcular() { celdaImporte.textContent = App.ui.euro(importeSesion(ambito)); }

    return el('tr', {}, [
      el('td', { style: 'min-width:300px;width:42%;white-space:normal;padding-left:28px' }, [
        el('div', { style: 'display:flex;gap:8px;align-items:flex-start' }, [
          el('span', { class: 'num silencio', style: 'padding-top:10px;min-width:34px', text: numeroAmbito(gi, ai) }),
          el('textarea', {
            rows: '3', text: ambito.nombre, placeholder: 'Nombre del ámbito',
            style: 'width:100%;font:inherit;padding:9px 12px;border:1px solid var(--outline);border-radius:var(--radio);resize:vertical',
            'aria-label': 'Nombre del ámbito ' + numeroAmbito(gi, ai),
            onInput: function (e) {
              var v = e.target.value;
              App.store.muta(function () { ambito.nombre = v; });
            }
          })
        ])
      ]),
      celdaNumero(ambito, 'horasMax', 'h.', null, false, recalcular),
      celdaNumero(ambito, 'importeHora', '€', null, false, recalcular),
      celdaImporte,
      celdaNumero(ambito, 'unidades', '', '1'),
      el('td', {}, [
        el('button', {
          class: 'btn peligro pequeno', 'aria-label': 'Quitar ámbito ' + numeroAmbito(gi, ai),
          onClick: function () { quitarAmbito(grupo, ambito); }
        }, [icono('papelera', 14)])
      ])
    ]);
  }

  function filaGrupoConfig(g, gi) {
    return el('tr', { class: 'fila-grupo' }, [
      el('td', { colspan: '5' }, [
        el('div', { style: 'display:flex;gap:10px;align-items:center' }, [
          botonGrupo('config', g, numeroGrupo(gi)),
          el('input', {
            type: 'text', value: g.nombre, placeholder: 'Nombre del grupo',
            style: 'font-weight:600;max-width:340px',
            'aria-label': 'Nombre del grupo ' + numeroGrupo(gi),
            onInput: function (e) {
              var v = e.target.value;
              App.store.muta(function () { g.nombre = v; });
            }
          }),
          el('span', { class: 'silencio', text: g.ambitos.length + (g.ambitos.length === 1 ? ' ámbito' : ' ámbitos') }),
          el('button', {
            class: 'btn secundario pequeno', 'aria-label': 'Añadir ámbito al grupo ' + numeroGrupo(gi),
            onClick: function () {
              App.store.muta(function () { g.ambitos.push(ambitoNuevo()); });
              plegado.config[g.id] = false;
              App.render();
            }
          }, '+ Ámbito')
        ])
      ]),
      el('td', {}, [
        el('button', {
          class: 'btn peligro pequeno', 'aria-label': 'Quitar grupo ' + numeroGrupo(gi),
          onClick: function () { quitarGrupo(g); }
        }, [icono('papelera', 14)])
      ])
    ]);
  }

  function tarjetaAmbitos() {
    var gs = grupos();
    var filas = [];
    gs.forEach(function (g, gi) {
      filas.push(filaGrupoConfig(g, gi));
      visibles('config', g).forEach(function (a, ai) { filas.push(fila(g, a, gi, ai)); });
    });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('documento'), 'Ámbitos de actuación']),
        el('button', {
          class: 'btn secundario pequeno',
          onClick: function () {
            App.store.muta(function (st) { st.asistencia.grupos.push(grupoNuevo()); });
            App.render();
          }
        }, 'Añadir grupo')
      ]),
      el('p', {
        class: 'silencio',
        text: 'Los ámbitos se organizan en grupos (1, 2, 3…), que sólo sirven para clasificar y no llevan datos. Para cada ámbito (1.1, 1.2…): las horas máximas de una asistencia, el importe por hora y el número de unidades funcionales (personas).'
      }),
      gs.length
        ? el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
            el('table', {}, [
              el('thead', {}, [el('tr', {}, [
                el('th', { text: 'Grupo / ámbito de actuación' }),
                el('th', { text: 'Horas máx. por asistencia' }),
                el('th', { text: 'Importe por hora' }),
                el('th', { class: 'n', text: 'Importe asistencia' }),
                el('th', { text: 'Unidades funcionales' }),
                el('th', {})
              ])]),
              el('tbody', {}, filas)
            ])
          ])
        : el('p', { class: 'sin-datos', text: 'No hay grupos. Añada el primero.' })
    ]);
  }

  function tarjetaSesiones() {
    var gs = grupos();
    var filas = [];
    gs.forEach(function (g, gi) {
      filas.push(el('tr', { class: 'fila-grupo' }, [
        el('td', { colspan: String(1 + FASES.length) }, [
          botonGrupo('config', g, numeroGrupo(gi) + ' ' + nombreDe(g))
        ])
      ]));
      visibles('config', g).forEach(function (a, ai) {
        filas.push(el('tr', {}, [
          el('td', { style: 'white-space:normal;min-width:200px;width:30%;padding-left:28px' }, [
            el('span', { class: 'num silencio', text: numeroAmbito(gi, ai) + ' ' }), nombreDe(a)
          ])
        ].concat(FASES.map(function (f) { return celdaNumero(a, f.id, 'asist.', '1', true); }))));
      });
    });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('mesa'), 'Máximo de asistencias por fase'])]),
      el('p', {
        class: 'silencio',
        text: 'Número máximo de asistencias que puede realizar cada ámbito en cada fase. Los grupos y ámbitos se gestionan en el bloque de arriba.'
      }),
      gs.length
        ? el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
            el('table', {}, [
              el('thead', {}, [el('tr', {}, [el('th', { text: 'Grupo / ámbito de actuación' })].concat(
                FASES.map(function (f) { return el('th', { text: f.nombre }); })
              ))]),
              el('tbody', {}, filas)
            ])
          ])
        : el('p', { class: 'sin-datos', text: 'Añada primero algún grupo de ámbitos.' })
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

  /* Totales de una lista de ámbitos: se usa tanto para cada grupo (su
     subtotal) como para el conjunto. */
  function sumar(ambitos) {
    var t = { importes: { previa: 0, electoral: 0, cierre: 0 }, asist: { previa: 0, electoral: 0, cierre: 0 },
      total: 0, unidades: 0, asistencias: 0 };
    ambitos.forEach(function (a) {
      FASES.forEach(function (f) {
        t.importes[f.id] += importeFase(a, f.id);
        t.asist[f.id] += Number(asistenciasDe(a)[f.id]) || 0;
      });
      t.total += importeTotal(a);
      t.unidades += Number(a.unidades) || 0;
      t.asistencias += totalAsistencias(a);
    });
    return t;
  }

  /* `ids` limita el análisis a esos grupos (los de una exportación); sin él
     se analizan todos. La numeración es siempre la del orden real. */
  function datosAnalisis(ids) {
    var gs = [];
    grupos().forEach(function (g, gi) {
      if (ids && ids.indexOf(g.id) < 0) { return; }
      gs.push({
        grupo: g, numero: numeroGrupo(gi), sub: sumar(g.ambitos),
        filas: g.ambitos.map(function (a, ai) {
          var s1 = sumar([a]);
          return {
            ambito: a, numero: numeroAmbito(gi, ai), importes: s1.importes, total: s1.total,
            porUnidad: importeSesion(a) * totalAsistencias(a)
          };
        })
      });
    });
    var elegidos = gs.reduce(function (t, gd) { return t.concat(gd.grupo.ambitos); }, []);
    var todo = sumar(elegidos);
    return { grupos: gs, porFase: todo.importes, total: todo.total, asistencias: todo.asistencias, unidades: todo.unidades };
  }

  function pct(parte, total) { return total ? App.ui.porcentaje(parte, total) : '—'; }

  function etiquetaGrupo(vista, d) {
    return el('span', {}, [botonGrupo(vista, d.grupo, d.numero + ' ' + nombreDe(d.grupo)), el('span', { class: 'silencio', text: '  subtotal' })]);
  }

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
    var filas = [];
    d.grupos.forEach(function (gd) {
      filas.push(el('tr', { class: 'fila-grupo' }, [
        el('td', {}, [etiquetaGrupo('dash', gd)]),
        el('td', { class: 'n', text: App.ui.numero(gd.sub.unidades) })
      ].concat(
        FASES.map(function (fa) { return el('td', { class: 'n', text: App.ui.euro(gd.sub.importes[fa.id]) }); }),
        [el('td', { class: 'n', text: App.ui.euro(gd.sub.total) }), el('td', {}), el('td', { class: 'n', text: pct(gd.sub.total, d.total) })]
      )));
      if (plegado.dash[gd.grupo.id]) { return; }
      gd.filas.forEach(function (f) {
        filas.push(el('tr', {}, [
          el('td', { style: 'white-space:normal;min-width:160px;padding-left:28px' }, [
            el('span', { class: 'num silencio', text: f.numero + ' ' }), nombreDe(f.ambito)
          ]),
          el('td', { class: 'n', text: App.ui.numero(Number(f.ambito.unidades) || 0) })
        ].concat(
          FASES.map(function (fa) { return el('td', { class: 'n', text: App.ui.euro(f.importes[fa.id]) }); }),
          [
            el('td', { class: 'n', style: 'font-weight:600', text: App.ui.euro(f.total) }),
            el('td', { class: 'n', text: App.ui.euro(f.porUnidad) }),
            el('td', { class: 'n', text: pct(f.total, d.total) })
          ]
        )));
      });
    });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('euro'), 'Desglose de importes por ámbito y fase'])]),
      el('p', {
        class: 'silencio',
        text: 'Importe de cada fase (importe por asistencia × asistencias × unidades funcionales), con el subtotal de cada grupo, y lo que cuesta cada unidad funcional, es decir, cada persona del ámbito.'
      }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Grupo / ámbito de actuación' }),
            el('th', { class: 'n', style: 'white-space:normal', text: 'Unidades funcionales' })
          ].concat(
            FASES.map(function (f) { return el('th', { class: 'n', style: 'white-space:normal', text: f.nombre }); }),
            [
              el('th', { class: 'n', text: 'Total' }),
              el('th', { class: 'n', style: 'white-space:normal', text: 'Coste por unidad funcional' }),
              el('th', { class: 'n', style: 'white-space:normal', text: '% del total' })
            ]
          ))]),
          el('tbody', {}, filas),
          el('tfoot', {}, [el('tr', {}, [el('td', { text: 'Total' }), el('td', {})].concat(
            FASES.map(function (f) { return el('td', { class: 'n', text: App.ui.euro(d.porFase[f.id]) }); }),
            [el('td', { class: 'n', text: App.ui.euro(d.total) }), el('td', {}), el('td', { class: 'n', text: d.total ? '100 %' : '—' })]
          ))])
        ])
      ])
    ]);
  }

  function graficaApilada(d) {
    var max = 0;
    d.grupos.forEach(function (gd) {
      max = Math.max(max, gd.sub.total);
      gd.filas.forEach(function (f) { max = Math.max(max, f.total); });
    });

    function barra(importes, total, claseFila, etiqueta, titulo) {
      return el('div', { class: 'gr-fila' + (claseFila ? ' ' + claseFila : '') }, [
        etiqueta,
        el('div', { class: 'gr-pista', style: 'display:flex' }, FASES.map(function (fa) {
          return el('div', {
            title: titulo + ' · ' + fa.nombre + ': ' + App.ui.euro(importes[fa.id]),
            style: 'height:100%;width:' + (importes[fa.id] / max * 100) + '%;background:' + COLOR_FASE[fa.id]
          });
        })),
        el('span', { class: 'gr-valor', text: App.ui.euro(total) })
      ]);
    }

    var contenido;
    if (!max) {
      contenido = el('p', { class: 'gr-vacia', text: 'Sin importes que representar: introduzca asistencias.' });
    } else {
      var filas = [];
      d.grupos.forEach(function (gd) {
        var nombreG = gd.numero + ' ' + nombreDe(gd.grupo);
        filas.push(barra(gd.sub.importes, gd.sub.total, 'gr-grupo',
          el('span', { style: 'font-weight:600' }, [botonGrupo('dash', gd.grupo, nombreG)]), nombreG + ' (subtotal)'));
        if (plegado.dash[gd.grupo.id]) { return; }
        gd.filas.forEach(function (f) {
          var nombre = f.numero + ' ' + nombreDe(f.ambito);
          filas.push(barra(f.importes, f.total, '',
            el('span', { class: 'gr-etiqueta', style: 'padding-left:28px', title: nombre, text: nombre }), nombre));
        });
      });
      contenido = el('div', { class: 'gr-barras' }, filas);
    }
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', { text: 'Importe por ámbito, dividido por fases' })]),
      leyendaFases(),
      contenido
    ]);
  }

  /* Asistencias frente al máximo de asistencias configurado. Sin máximo (0) no se
     juzga: se muestra el dato sin barra. Por encima del máximo se marca en rojo.
     En la fila de grupo se suman asistencias y máximos de sus ámbitos y se avisa
     si alguno de ellos se pasa. */
  function ocupacion(d) {
    function excede(a, fase) {
      var m = Number(sesionesDe(a)[fase]) || 0;
      return m > 0 && (Number(asistenciasDe(a)[fase]) || 0) > m;
    }

    function celda(n, m, color, avisoGrupo) {
      if (!m) {
        return el('td', {}, [el('span', { class: 'silencio', text: n + ' / sin máximo' })]);
      }
      var sobre = n > m;
      return el('td', {}, [
        el('div', { style: 'display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:4px' }, [
          el('span', { class: 'num', style: sobre ? 'color:var(--error);font-weight:600' : '', text: n + ' / ' + m }),
          (sobre && !avisoGrupo) ? el('span', { class: 'chip', style: 'background:var(--error-container);color:var(--error)', text: 'Supera el máximo' }) : null,
          avisoGrupo ? el('span', { class: 'chip', style: 'background:var(--error-container);color:var(--error)', text: avisoGrupo }) : null
        ]),
        el('div', { class: 'gr-pista', style: 'height:8px' }, [
          el('div', {
            class: 'gr-barra',
            style: 'width:' + Math.min(100, n / m * 100) + '%;background:' + (sobre ? 'var(--error)' : color)
          })
        ])
      ]);
    }

    var excesos = 0;
    var filas = [];
    d.grupos.forEach(function (gd) {
      var g = gd.grupo;
      var dentro = g.ambitos.map(function (a) { return FASES.filter(function (f) { return excede(a, f.id); }).length; });
      excesos += dentro.reduce(function (t, n) { return t + n; }, 0);

      filas.push(el('tr', { class: 'fila-grupo' }, [el('td', {}, [etiquetaGrupo('dash', gd)])].concat(FASES.map(function (f) {
        var m = g.ambitos.reduce(function (t, a) { return t + (Number(sesionesDe(a)[f.id]) || 0); }, 0);
        var fuera = g.ambitos.filter(function (a) { return excede(a, f.id); }).length;
        return celda(gd.sub.asist[f.id], m, COLOR_FASE[f.id], fuera ? fuera + (fuera === 1 ? ' ámbito supera' : ' ámbitos superan') : null);
      }))));
      if (plegado.dash[g.id]) { return; }
      gd.filas.forEach(function (f) {
        filas.push(el('tr', {}, [
          el('td', { style: 'white-space:normal;min-width:200px;padding-left:28px' }, [
            el('span', { class: 'num silencio', text: f.numero + ' ' }), nombreDe(f.ambito)
          ])
        ].concat(FASES.map(function (fa) {
          return celda(Number(asistenciasDe(f.ambito)[fa.id]) || 0, Number(sesionesDe(f.ambito)[fa.id]) || 0, COLOR_FASE[fa.id], null);
        }))));
      });
    });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', { text: 'Asistencias frente al máximo' }),
        excesos
          ? el('span', { class: 'chip', style: 'background:var(--error-container);color:var(--error)', text: excesos + (excesos === 1 ? ' fase supera' : ' fases superan') + ' su máximo' })
          : el('span', { class: 'chip ok', text: 'Todo dentro de los máximos' })
      ]),
      el('p', { class: 'silencio', text: 'Máximos definidos en Configuración de Asistencia. En cada grupo se suman las asistencias y los máximos de sus ámbitos.' }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [el('th', { text: 'Grupo / ámbito de actuación' })].concat(
            FASES.map(function (f) { return el('th', { text: f.nombre }); })
          ))]),
          el('tbody', {}, filas)
        ])
      ])
    ]);
  }

  /* Se repinta entero cada vez que cambia una asistencia: son pocas filas. */
  function pintarAnalisis(contenedor) {
    var d = datosAnalisis();
    App.ui.vaciar(contenedor);
    [indicadores(d), tablaDesglose(d), graficaApilada(d), ocupacion(d)].forEach(function (n) {
      contenedor.appendChild(n);
    });
  }

  App.vistas = App.vistas || {};

  /* Dashboard: una fila por ámbito, agrupadas, con sus asistencias por fase, el
     total y el importe (importe sesión × asistencias × unidades). Cada grupo
     muestra el subtotal de sus ámbitos. Todo se recalcula al escribir, sin
     repintar la tabla. */
  function tarjetaDashboard() {
    var gs = grupos();
    if (!todosLosAmbitos().length) {
      return el('section', { class: 'tarjeta' }, [
        el('p', { class: 'sin-datos', text: 'No hay ámbitos. Añádalos en Configuración de Asistencia.' })
      ]);
    }

    var analisis = el('div', { class: 'apilar', style: 'gap:24px' });
    var celdaPieUni = el('td', { class: 'n' });
    var celdaPieAsis = el('td', { class: 'n' });
    var celdaPieImp = el('td', { class: 'n' });
    var celdasPieFase = FASES.map(function () { return el('td', { class: 'n' }); });
    var actualizadoresGrupo = [];

    function actualizarPie() {
      var t = sumar(todosLosAmbitos());
      celdaPieUni.textContent = App.ui.numero(t.unidades);
      celdaPieAsis.textContent = App.ui.numero(t.asistencias);
      celdaPieImp.textContent = App.ui.euro(t.total);
      FASES.forEach(function (f, i) { celdasPieFase[i].textContent = App.ui.numero(t.asist[f.id]); });
      actualizadoresGrupo.forEach(function (fn) { fn(); });
      pintarAnalisis(analisis);
    }

    var filas = [];
    gs.forEach(function (g, gi) {
      var cUni = el('td', { class: 'n' });
      var cFases = FASES.map(function () { return el('td', { class: 'n' }); });
      var cTot = el('td', { class: 'n' });
      var cImp = el('td', { class: 'n' });
      function actualizarGrupo() {
        var t = sumar(g.ambitos);
        cUni.textContent = App.ui.numero(t.unidades);
        FASES.forEach(function (f, i) { cFases[i].textContent = App.ui.numero(t.asist[f.id]); });
        cTot.textContent = App.ui.numero(t.asistencias);
        cImp.textContent = App.ui.euro(t.total);
      }
      actualizarGrupo();
      actualizadoresGrupo.push(actualizarGrupo);

      filas.push(el('tr', { class: 'fila-grupo' }, [
        el('td', {}, [etiquetaGrupo('dash', { grupo: g, numero: numeroGrupo(gi) }), ]),
        cUni
      ].concat(cFases, [cTot, cImp])));

      visibles('dash', g).forEach(function (a, ai) {
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
            'aria-label': f.nombre + ' — ' + numeroAmbito(gi, ai) + ' ' + nombreDe(a),
            onInput: function (e) {
              var v = parseFloat(e.target.value);
              App.store.muta(function () { asistenciasDe(a)[f.id] = isNaN(v) ? 0 : v; });
              actualizar();
              actualizarPie();
            }
          })]);
        });

        filas.push(el('tr', {}, [
          el('td', { style: 'white-space:normal;min-width:200px;width:30%;padding-left:28px' }, [
            el('span', { class: 'num silencio', text: numeroAmbito(gi, ai) + ' ' }), nombreDe(a)
          ]),
          el('td', { class: 'n', text: App.ui.numero(Number(a.unidades) || 0) })
        ].concat(celdasFase, [celdaTotal, celdaImporte])));
      });
    });
    actualizarPie();

    var tarjetaTabla = el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('dashboard'), 'Asistencias por ámbito']),
        el('button', { class: 'btn', onClick: function () { App.asistencia.exportar(); } }, [icono('descarga', 16), 'Exportar'])
      ]),
      el('p', {
        class: 'silencio',
        text: 'Introduzca las asistencias de cada ámbito en cada fase. Cada grupo (fila sombreada) muestra el subtotal de sus ámbitos y se puede contraer o expandir. El importe total es el importe por asistencia del ámbito (Configuración) multiplicado por su total de asistencias y por sus unidades funcionales.'
      }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Grupo / ámbito de actuación' }),
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

  /* Lo que necesita la exportación (66-exportar-asistencia.js). */
  App.asistencia = {
    FASES: FASES, COLOR_FASE: COLOR_FASE,
    grupos: grupos, numeroGrupo: numeroGrupo, numeroAmbito: numeroAmbito, nombreDe: nombreDe,
    todosLosAmbitos: todosLosAmbitos, datosAnalisis: datosAnalisis, sumar: sumar,
    importeSesion: importeSesion, importeTotal: importeTotal, importeFase: importeFase,
    totalAsistencias: totalAsistencias, asistenciasDe: asistenciasDe, sesionesDe: sesionesDe
  };

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
