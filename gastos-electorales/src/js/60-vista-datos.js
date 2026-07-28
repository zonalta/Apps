/* Vista "Carga de Datos": los censos que alimentan los cálculos.
   Un mismo fichero puede traer varios censos, así que hay una sola zona de carga
   que detecta por la cabecera qué contiene y actualiza lo que corresponda. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  var CENSOS = [
    {
      id: 'mesas',
      titulo: 'Mesas por municipio',
      icono: 'mesa',
      columnas: 'MESAS',
      descripcion: 'Base de casi todos los cálculos: acondicionamiento, personal, montaje, miembros de mesa y el tramo del secretario.',
      mapa: function (s) { return s.mesas; },
      fijar: function (s, m) { s.mesas = m; }
    },
    {
      id: 'representantes',
      titulo: 'Representantes de la Administración',
      icono: 'grupo',
      columnas: 'PD0 … PD5',
      descripcion: 'Número de representantes de cada tipología. Cada uno cobra según su tipología.',
      mapa: function (s) { return s.representantes; },
      fijar: function (s, m) { s.representantes = m; }
    },
    {
      id: 'policia',
      titulo: 'Efectivos de policía',
      icono: 'escudo',
      columnas: 'EFECTIVOS',
      descripcion: 'Efectivos de Policía Autonómica y Local por municipio. Suele llegar en un fichero aparte.',
      mapa: function (s) { return s.policia; },
      fijar: function (s, m) { s.policia = m; }
    }
  ];

  function censo(id) {
    for (var i = 0; i < CENSOS.length; i++) {
      if (CENSOS[i].id === id) { return CENSOS[i]; }
    }
    return null;
  }

  function cuantos(id) {
    return Object.keys(censo(id).mapa(App.store.estado()) || {}).length;
  }

  /* Resultado de la última importación, fuera del DOM: el repintado que sigue a
     la carga se llevaría por delante cualquier aviso guardado en el nodo. */
  var ultima = null;

  /* ---------- Importación ---------- */

  function importar(file) {
    ultima = { leyendo: true, fichero: file.name };
    App.render();

    App.parsers.leerFichero(file)
      .then(function (filas) {
        var res = App.parsers.interpretarFicheroDatos(filas);

        var resumen = res.bloques.map(function (b) {
          var previos = censo(b.id).mapa(App.store.estado()) || {};
          var nuevos = 0;
          Object.keys(b.datos).forEach(function (c) {
            if (previos[c] === undefined) { nuevos += 1; }
          });
          return {
            id: b.id, nombre: b.nombre, municipios: b.municipios,
            nuevos: nuevos, actualizados: b.municipios - nuevos
          };
        });

        /* Se fusiona en vez de reemplazar: así un fichero por provincia se puede
           cargar en dos veces sin que el segundo borre al primero. Para empezar
           de cero está el botón de borrar de cada censo. */
        App.store.muta(function (s) {
          res.bloques.forEach(function (b) {
            var c = censo(b.id);
            var mezcla = {};
            var actual = c.mapa(s) || {};
            Object.keys(actual).forEach(function (k) { mezcla[k] = actual[k]; });
            Object.keys(b.datos).forEach(function (k) { mezcla[k] = b.datos[k]; });
            c.fijar(s, mezcla);
            s.cargas[b.id] = {
              fecha: new Date().toISOString(),
              fichero: file.name,
              filas: b.municipios
            };
          });
        });

        ultima = { fichero: file.name, res: res, resumen: resumen };
        App.ui.flotante(
          resumen.map(function (r) { return r.nombre.toLowerCase(); }).join(' y ') +
          ' actualizados desde ' + file.name
        );
        App.render();
      })
      .catch(function (err) {
        console.error(err);
        ultima = { fichero: file.name, error: err.message };
        App.ui.flotante('No se pudo importar ' + file.name, true);
        App.render();
      });
  }

  /* ---------- Zona de carga ---------- */

  function zonaCarga() {
    var input = el('input', {
      type: 'file',
      accept: '.csv,.tsv,.txt,.xlsx',
      onChange: function (e) {
        if (e.target.files && e.target.files[0]) { importar(e.target.files[0]); }
        e.target.value = '';
      }
    });

    var zona = el('div', {
      class: 'zona-carga grande',
      tabindex: '0',
      role: 'button',
      'aria-label': 'Cargar fichero de datos',
      onClick: function () { input.click(); },
      onKeydown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      },
      onDragover: function (e) { e.preventDefault(); zona.classList.add('encima'); },
      onDragleave: function () { zona.classList.remove('encima'); },
      onDrop: function (e) {
        e.preventDefault();
        zona.classList.remove('encima');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) { importar(e.dataTransfer.files[0]); }
      }
    }, [
      el('div', { class: 'icono-zona' }, [icono('carga', 26)]),
      el('h3', { text: 'Arrastre aquí el CSV o Excel, o pulse para seleccionarlo' }),
      el('p', {
        class: 'pista',
        text: 'Un mismo fichero puede traer varios censos: se detectan por la cabecera y se cargan de una vez.'
      }),
      input
    ]);

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('carga'), 'Cargar datos']),
        el('button', {
          class: 'btn secundario pequeno',
          onClick: descargarPlantillas
        }, [icono('descarga', 14), 'Plantillas CSV'])
      ]),
      zona,
      el('div', { class: 'rejilla tres', style: 'margin-top:20px' }, CENSOS.map(function (c) {
        return el('div', { class: 'columna-reconocida' }, [
          el('div', { class: 'fila' }, [
            icono(c.icono, 16),
            el('strong', { text: c.titulo })
          ]),
          el('code', { class: 'cabecera-esperada', text: c.columnas }),
          el('p', { class: 'silencio', text: c.descripcion })
        ]);
      })),
      el('p', {
        class: 'leyenda-nota',
        text: 'La columna de municipios debe llamarse MUNICIPIOS (o CÓDIGO / NOMBRE) y admite «35001», «AGAETE» o «35001 AGAETE». ' +
          'Las columnas que no se reconocen se ignoran sin estorbar; si hay una PROVINCIA, se usa para comprobar que concuerda con el código. ' +
          'Los municipios del fichero se actualizan y el resto se conserva, de modo que se puede cargar una provincia hoy y la otra mañana. ' +
          'Si el fichero trae una fila de TOTALES, se usa para comprobar que lo importado cuadra.'
      })
    ]);
  }

  /* ---------- Avisos de la última importación ---------- */

  function tarjetaResultado() {
    if (!ultima) { return null; }

    if (ultima.leyendo) {
      return el('section', { class: 'tarjeta' }, [
        el('p', { class: 'silencio', text: 'Leyendo ' + ultima.fichero + '…' })
      ]);
    }

    if (ultima.error) {
      return el('section', { class: 'tarjeta' }, [
        el('div', { class: 'aviso error' }, [
          icono('aviso'),
          el('div', {}, [
            el('strong', { text: ultima.fichero + ' — ' }),
            ultima.error
          ])
        ])
      ]);
    }

    var res = ultima.res;
    var partes = [];

    partes.push(el('div', { class: 'rejilla tres' }, ultima.resumen.map(function (r) {
      return el('div', { class: 'tarjeta kpi', style: 'box-shadow:none' }, [
        el('span', { class: 'etiqueta', text: r.nombre }),
        el('span', { class: 'valor num destacado', text: App.ui.numero(r.municipios) }),
        el('span', {
          class: 'nota',
          text: 'municipios · ' + r.nuevos + ' nuevos, ' + r.actualizados + ' actualizados'
        })
      ]);
    })));

    if (res.comprobacion) {
      var c = res.comprobacion;
      partes.push(el('div', { class: 'aviso ' + (c.cuadra ? 'ok' : 'error') }, [
        icono(c.cuadra ? 'check' : 'aviso'),
        el('div', {}, [
          el('strong', {
            text: c.cuadra
              ? 'Cuadra con la fila TOTALES del fichero. '
              : 'No cuadra con la fila TOTALES del fichero. '
          }),
          c.cuadra
            ? 'Comprobado: ' + c.lineas.map(function (l) {
                return l.columna + ' ' + App.ui.numero(l.declarado);
              }).join(' · ')
            : null,
          c.cuadra ? null : el('ul', { style: 'margin:8px 0 0;padding-left:20px' },
            c.lineas.filter(function (l) { return !l.cuadra; }).map(function (l) {
              return el('li', {
                text: l.columna + ': el fichero declara ' + App.ui.numero(l.declarado) +
                  ' y la suma de sus filas da ' + App.ui.numero(l.calculado)
              });
            })
          )
        ])
      ]));
    }

    /* Un representante por mesa: se informa, no se impone. */
    if (res.repVsMesas) {
      var rm = res.repVsMesas;
      partes.push(el('div', { class: 'aviso ' + (rm.desajustes.length ? '' : 'ok') }, [
        icono(rm.desajustes.length ? 'aviso' : 'check'),
        el('div', {}, [
          rm.desajustes.length
            ? el('strong', {
                text: rm.desajustes.length + ' municipio(s) donde los representantes no igualan a las mesas. '
              })
            : el('strong', {
                text: 'Un representante por mesa en los ' + rm.coinciden + ' municipios. '
              }),
          rm.desajustes.length
            ? 'En el resto sí coinciden. Se ha importado lo que dice el fichero; compruebe si es intencionado:'
            : 'La suma de PD0…PD5 coincide con el número de mesas en todos ellos.',
          rm.desajustes.length
            ? el('ul', { style: 'margin:8px 0 0;padding-left:20px' },
                rm.desajustes.slice(0, 6).map(function (d) {
                  return el('li', {
                    text: d.nombre + ': ' + d.representantes + ' representantes frente a ' + d.mesas + ' mesas'
                  });
                })
              )
            : null
        ])
      ]));
    }

    /* Se listan TODAS, no una muestra: para arreglar el fichero hay que saber
       exactamente qué filas se quedaron fuera. */
    if (res.noReconocidos.length) {
      partes.push(el('div', { class: 'aviso' }, [
        icono('aviso'),
        el('div', { style: 'min-width:0;flex:1' }, [
          el('strong', { text: res.noReconocidos.length + ' fila(s) sin municipio reconocible, ignoradas. ' }),
          'Revise cómo está escrito el municipio en estas filas:',
          el('ul', { class: 'lista-rechazos' },
            res.noReconocidos.map(function (t) { return el('li', { text: t }); })
          ),
          el('button', {
            class: 'btn secundario pequeno',
            style: 'margin-top:10px',
            onClick: function () {
              App.ui.descargar(
                'filas-no-reconocidas.csv',
                App.ui.aCSV([['VALOR EN EL FICHERO']].concat(
                  res.noReconocidos.map(function (t) { return [t]; })
                ))
              );
            }
          }, [icono('descarga', 14), 'Descargar la lista'])
        ])
      ]));
    }

    if (res.provinciasDiscordantes && res.provinciasDiscordantes.length) {
      partes.push(el('div', { class: 'aviso error' }, [
        icono('aviso'),
        el('div', {}, [
          el('strong', {
            text: res.provinciasDiscordantes.length + ' fila(s) cuya columna PROVINCIA no concuerda con el código. '
          }),
          'La provincia se deduce siempre del código del municipio, así que los datos están donde deben; ' +
          'pero revise el fichero, porque suele delatar filas mal copiadas:',
          el('ul', { style: 'margin:8px 0 0;padding-left:20px' },
            res.provinciasDiscordantes.slice(0, 5).map(function (d) {
              return el('li', {
                text: '«' + d.texto + '» — el fichero dice ' + d.declarada + ' y por código es ' + d.real
              });
            })
          )
        ])
      ]));
    }

    if (res.discrepancias.length) {
      partes.push(el('div', { class: 'aviso error' }, [
        icono('aviso'),
        el('div', {}, [
          el('strong', {
            text: res.discrepancias.length + ' fila(s) con el código y el nombre en desacuerdo. '
          }),
          'Los datos se han importado usando el código. Revise si el fichero sigue otra codificación:',
          el('ul', { style: 'margin:8px 0 0;padding-left:20px' },
            res.discrepancias.slice(0, 5).map(function (d) {
              return el('li', {
                text: '«' + d.texto + '» — el código ' + d.codigo + ' corresponde a ' + d.nombreEsperado
              });
            })
          ),
          res.discrepancias.length > 5
            ? el('p', { style: 'margin-top:6px', text: 'y ' + (res.discrepancias.length - 5) + ' más.' })
            : null
        ])
      ]));
    }

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('documento'), 'Resultado de la importación']),
        el('span', { class: 'silencio', text: ultima.fichero })
      ]),
      el('div', { class: 'apilar' }, partes)
    ]);
  }

  /* ---------- Estado de los censos ---------- */

  function borrarCenso(c) {
    App.ui.confirmar({
      titulo: 'Borrar «' + c.titulo + '»',
      parrafos: [
        'Se borrarán los datos de ' + cuantos(c.id) + ' municipios de este censo.',
        'Las tarifas de la configuración no se tocan, y los demás censos se quedan como están.'
      ],
      textoConfirmar: 'Borrar el censo',
      peligro: true,
      alConfirmar: function () {
        App.store.muta(function (s) {
          c.fijar(s, {});
          delete s.cargas[c.id];
        });
        App.ui.flotante('Datos de «' + c.titulo + '» borrados');
        App.render();
      }
    });
  }

  function tarjetaCensos() {
    var estado = App.store.estado();
    var total = App.geo.MUNICIPIOS.length;

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('documento'), 'Censos cargados'])]),
      el('div', { class: 'rejilla tres' }, CENSOS.map(function (c) {
        var n = cuantos(c.id);
        var carga = estado.cargas[c.id];

        return el('div', { class: 'ficha-censo' }, [
          el('div', { class: 'entre' }, [
            el('div', { class: 'fila' }, [icono(c.icono, 18), el('strong', { text: c.titulo })]),
            n
              ? el('span', { class: 'chip ok' }, [icono('check', 13), n + ' / ' + total])
              : el('span', { class: 'chip pendiente', text: 'Sin datos' })
          ]),
          n && carga
            ? el('p', {
                class: 'silencio',
                text: carga.fichero + ' · ' + App.ui.fecha(new Date(carga.fecha))
              })
            : el('p', { class: 'silencio', text: 'Cargue un fichero con la columna ' + c.columnas + '.' }),
          n
            ? el('button', {
                class: 'btn peligro pequeno',
                onClick: function () { borrarCenso(c); }
              }, [icono('papelera', 14), 'Borrar este censo'])
            : null
        ]);
      }))
    ]);
  }

  /* ---------- Tabla de comprobación ---------- */

  function tablaEstadoDatos() {
    var estado = App.store.estado();
    var filas = App.geo.ordenarPorNombre(App.geo.MUNICIPIOS).map(function (m) {
      var reps = estado.representantes[m.codigo] || {};
      var totalReps = App.store.TIPOLOGIAS_PD.reduce(function (a, t) {
        return a + (Number(reps[t]) || 0);
      }, 0);
      return {
        m: m,
        mesas: Number(estado.mesas[m.codigo]) || 0,
        reps: totalReps,
        policia: Number(estado.policia[m.codigo]) || 0
      };
    }).filter(function (f) { return f.mesas || f.reps || f.policia; });

    if (!filas.length) {
      return el('section', { class: 'tarjeta' }, [
        el('header', {}, [el('h2', {}, [icono('documento'), 'Datos por municipio'])]),
        el('p', {
          class: 'sin-datos',
          text: 'Todavía no hay datos cargados. Empiece por las mesas: sin ellas no hay cálculo posible.'
        })
      ]);
    }

    var cuerpo = el('tbody');
    filas.forEach(function (f) {
      cuerpo.appendChild(el('tr', {}, [
        el('td', { class: 'num', text: f.m.codigo }),
        el('td', { text: f.m.nombre }),
        el('td', { text: App.geo.isla(f.m.isla).nombre }),
        el('td', { class: 'n', text: App.ui.numero(f.mesas) }),
        el('td', { class: 'n', text: App.ui.numero(f.reps) }),
        el('td', { class: 'n', text: App.ui.numero(f.policia) })
      ]));
    });

    var totales = filas.reduce(function (a, f) {
      a.mesas += f.mesas; a.reps += f.reps; a.policia += f.policia;
      return a;
    }, { mesas: 0, reps: 0, policia: 0 });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('documento'), 'Datos por municipio']),
        el('span', {
          class: 'silencio',
          text: filas.length + ' de ' + App.geo.MUNICIPIOS.length + ' municipios con datos'
        })
      ]),
      el('div', { class: 'tabla-scroll alta' }, [
        el('table', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Código' }),
              el('th', { text: 'Municipio' }),
              el('th', { text: 'Isla' }),
              el('th', { class: 'n', text: 'Mesas' }),
              el('th', { class: 'n', text: 'Representantes' }),
              el('th', { class: 'n', text: 'Efectivos policía' })
            ])
          ]),
          cuerpo,
          el('tfoot', {}, [
            el('tr', {}, [
              el('td', { colspan: '3', text: 'Total' }),
              el('td', { class: 'n', text: App.ui.numero(totales.mesas) }),
              el('td', { class: 'n', text: App.ui.numero(totales.reps) }),
              el('td', { class: 'n', text: App.ui.numero(totales.policia) })
            ])
          ])
        ])
      ])
    ]);
  }

  /* ---------- Plantillas ---------- */

  function descargarPlantillas() {
    var datos = [['MUNICIPIOS'].concat(App.store.TIPOLOGIAS_PD).concat(['MESAS'])];
    var policia = [['MUNICIPIOS', 'EFECTIVOS']];

    App.geo.MUNICIPIOS.forEach(function (m) {
      var etiqueta = m.codigo + ' ' + m.nombre;
      datos.push([etiqueta, '', '', '', '', '', '', '']);
      policia.push([etiqueta, '']);
    });

    App.ui.descargar('plantilla-representantes-y-mesas.csv', App.ui.aCSV(datos));
    setTimeout(function () {
      App.ui.descargar('plantilla-policia.csv', App.ui.aCSV(policia));
    }, 400);
    App.ui.flotante('Descargando las plantillas con los 88 municipios');
  }

  /* ---------- Convocatoria ---------- */

  function nombreCopia() {
    var conv = App.store.estado().convocatoria || 'proceso';
    var limpio = App.geo.normaliza(conv).replace(/ /g, '-') || 'proceso';
    return 'gastos-' + limpio + '-' + new Date().toISOString().slice(0, 10) + '.json';
  }

  function botonRestaurar() {
    var input = el('input', {
      type: 'file', accept: '.json', style: 'display:none',
      onChange: function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) { return; }
        f.text().then(function (txt) {
          App.store.importar(JSON.parse(txt));
          ultima = null;
          App.ui.flotante('Copia restaurada');
          App.render();
        }).catch(function () {
          App.ui.flotante('El fichero no es una copia válida', true);
        });
      }
    });
    return el('span', {}, [
      el('button', {
        class: 'btn secundario',
        onClick: function () { input.click(); }
      }, [icono('carga', 16), 'Restaurar copia']),
      input
    ]);
  }

  function hayDatos() {
    return CENSOS.some(function (c) { return cuantos(c.id) > 0; });
  }

  function borrarTodosLosCensos() {
    App.ui.confirmar({
      titulo: 'Borrar todos los censos',
      parrafos: ['Se borrarán por completo:'],
      lista: CENSOS
        .filter(function (c) { return cuantos(c.id) > 0; })
        .map(function (c) { return c.titulo + ' — ' + cuantos(c.id) + ' municipios'; }),
      aviso: 'Las tarifas se conservan. Si aún no ha exportado una copia de esta convocatoria, cancele y expórtela primero.',
      textoConfirmar: 'Borrar los censos',
      peligro: true,
      alConfirmar: function () {
        App.store.muta(function (s) {
          CENSOS.forEach(function (c) { c.fijar(s, {}); });
          s.cargas = {};
        });
        ultima = null;
        App.ui.flotante('Censos borrados. Las tarifas siguen configuradas.');
        App.render();
      }
    });
  }

  function tarjetaConvocatoria() {
    var estado = App.store.estado();
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('refrescar'), 'Cambio de convocatoria']),
        hayDatos()
          ? el('span', { class: 'chip ok', text: estado.convocatoria })
          : el('span', { class: 'chip pendiente', text: 'Sin censos cargados' })
      ]),
      el('p', {
        class: 'silencio',
        text: 'Para reutilizar la herramienta en otro proceso electoral: exporte una copia de la convocatoria actual, borre los censos y cargue los nuevos. Las tarifas se mantienen para que sólo tenga que retocar lo que haya cambiado.'
      }),

      el('div', { class: 'fila', style: 'margin-top:18px' }, [
        el('button', {
          class: 'btn secundario',
          onClick: function () {
            App.ui.descargar(nombreCopia(), JSON.stringify(App.store.exportar(), null, 2), 'application/json');
          }
        }, [icono('descarga', 16), 'Exportar copia (JSON)']),
        botonRestaurar(),
        el('button', {
          class: 'btn peligro',
          disabled: !hayDatos(),
          onClick: borrarTodosLosCensos
        }, [icono('papelera', 16), 'Borrar todos los censos'])
      ]),

      el('p', {
        class: 'leyenda-nota',
        text: 'La copia en JSON guarda las tarifas y los tres censos de la convocatoria. Restaurarla devuelve ese proceso tal y como estaba, así que sirve para volver a 2023 después de haber trabajado en 2027.'
      }),

      el('div', { class: 'fila', style: 'margin-top:14px' }, [
        el('button', {
          class: 'btn fantasma pequeno',
          onClick: function () {
            App.ui.confirmar({
              titulo: 'Reiniciar la aplicación entera',
              parrafos: [
                'Se borrarán las tarifas y todos los censos, dejando la aplicación como recién instalada.'
              ],
              aviso: 'Esto no se puede deshacer salvo restaurando una copia JSON.',
              textoConfirmar: 'Reiniciar todo',
              peligro: true,
              alConfirmar: function () {
                App.store.reiniciar();
                ultima = null;
                App.ui.flotante('Aplicación reiniciada por completo');
                App.render();
              }
            });
          }
        }, 'Reiniciar también las tarifas')
      ])
    ]);
  }

  App.vistas = App.vistas || {};
  App.vistas.datos = {
    titulo: 'Carga de Datos',
    subtitulo: 'Cargue los censos del proceso desde CSV o Excel. Los municipios se reconocen por código o por nombre, y un mismo fichero puede traer varios censos a la vez.',
    render: function () {
      return el('div', { class: 'apilar', style: 'gap:24px' }, [
        zonaCarga(),
        tarjetaResultado(),
        tarjetaCensos(),
        tablaEstadoDatos(),
        tarjetaConvocatoria()
      ]);
    }
  };
})(window.App = window.App || {});
