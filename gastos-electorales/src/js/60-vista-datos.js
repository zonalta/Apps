/* Vista "Carga de Datos": los tres censos que alimentan los cálculos. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  var FUENTES = [
    {
      id: 'mesas',
      titulo: 'Mesas por municipio',
      icono: 'mesa',
      descripcion: 'Número de mesas electorales de cada municipio. Es el dato del que dependen casi todos los cálculos.',
      formato: 'Dos columnas: municipio (código INE, nombre o "35001 AGAETE") y número de mesas.',
      interpretar: 'interpretarMesas',
      aplicar: function (s, datos) { s.mesas = datos; },
      limpiar: function (s) { s.mesas = {}; }
    },
    {
      id: 'representantes',
      titulo: 'Representantes por municipio',
      icono: 'grupo',
      descripcion: 'Número de representantes de la Administración de cada municipio, desglosado por tipología PD0 a PD5.',
      formato: 'Cabecera con MUNICIPIOS | PD0 | PD1 | PD2 | PD3 | PD4 | PD5 (la columna TOTAL, si existe, se ignora).',
      interpretar: 'interpretarRepresentantes',
      aplicar: function (s, datos) { s.representantes = datos; },
      limpiar: function (s) { s.representantes = {}; }
    },
    {
      id: 'policia',
      titulo: 'Efectivos de policía por municipio',
      icono: 'escudo',
      descripcion: 'Efectivos de Policía Autonómica y Local asignados a cada municipio.',
      formato: 'Dos columnas: municipio y número de efectivos.',
      interpretar: 'interpretarPolicia',
      aplicar: function (s, datos) { s.policia = datos; },
      limpiar: function (s) { s.policia = {}; }
    }
  ];

  /* Cuántos municipios tiene cargados una fuente ahora mismo. Se cuenta sobre los
     datos, no sobre el registro de la carga: así el chip dice la verdad aunque el
     estado se haya restaurado desde una copia antigua. */
  function cuantosDatos(fuenteId) {
    var s = App.store.estado();
    var mapa = fuenteId === 'mesas' ? s.mesas
      : fuenteId === 'representantes' ? s.representantes
        : s.policia;
    return Object.keys(mapa || {}).length;
  }

  function borrarFuente(fuente) {
    var n = cuantosDatos(fuente.id);
    if (!window.confirm(
      'Se borrarán los datos de «' + fuente.titulo + '» (' + n + ' municipios).\n\n' +
      'Las tarifas de la configuración no se tocan.\n¿Continuar?'
    )) { return; }

    App.store.muta(function (s) {
      fuente.limpiar(s);
      delete s.cargas[fuente.id];
    });
    delete ultimaCarga[fuente.id];
    App.ui.flotante('Datos de «' + fuente.titulo + '» borrados');
    App.render();
  }

  function resumenCarga(fuente) {
    var carga = App.store.estado().cargas[fuente.id];
    var n = cuantosDatos(fuente.id);

    if (!n) {
      return el('span', { class: 'chip pendiente', text: 'Sin datos cargados' });
    }

    return el('div', { class: 'fila' }, [
      el('span', { class: 'chip ok' }, [icono('check', 13), App.ui.numero(n) + ' municipios']),
      carga
        ? el('span', {
            class: 'silencio',
            text: carga.fichero + ' · ' + App.ui.fecha(new Date(carga.fecha))
          })
        : null,
      el('button', {
        class: 'btn peligro pequeno',
        title: 'Borrar los datos de ' + fuente.titulo,
        onClick: function () { borrarFuente(fuente); }
      }, [icono('papelera', 14), 'Borrar'])
    ]);
  }

  function procesar(fuente, file, alTerminar) {
    App.parsers.leerFichero(file)
      .then(function (filas) {
        var res = App.parsers[fuente.interpretar](filas);
        var n = Object.keys(res.datos).length;
        if (!n) {
          throw new Error('No se reconoció ningún municipio en el fichero. ' +
            'Revise que la primera columna contenga el código o el nombre del municipio.');
        }
        App.store.muta(function (s) {
          fuente.aplicar(s, res.datos);
          s.cargas[fuente.id] = {
            fecha: new Date().toISOString(),
            fichero: file.name,
            filas: n
          };
        });
        alTerminar(null, res.resumen);
      })
      .catch(function (err) {
        console.error(err);
        alTerminar(err);
      });
  }

  /* El resultado de la última importación de cada fuente vive fuera del DOM: si
     se guardase en el nodo, el repintado que sigue a la carga se lo llevaría por
     delante y los avisos no llegarían a leerse. */
  var ultimaCarga = {};

  function avisosDeCarga(fuente) {
    var estado = ultimaCarga[fuente.id];
    var bloque = el('div', { class: 'apilar junto', style: 'width:100%;margin-top:14px' });
    if (!estado) { return bloque; }

    if (estado.leyendo) {
      bloque.appendChild(el('p', { class: 'silencio', text: 'Leyendo ' + estado.fichero + '…' }));
      return bloque;
    }

    if (estado.error) {
      bloque.appendChild(el('div', { class: 'aviso error' }, [
        icono('aviso'), el('div', { text: estado.error })
      ]));
      return bloque;
    }

    var res = estado.res;

    if (res.noReconocidos.length) {
      var muestra = res.noReconocidos.slice(0, 6).join(', ');
      bloque.appendChild(el('div', { class: 'aviso' }, [
        icono('aviso'),
        el('div', {}, [
          el('strong', { text: res.noReconocidos.length + ' fila(s) sin municipio reconocible. ' }),
          'Se han ignorado: ' + muestra + (res.noReconocidos.length > 6 ? '…' : '')
        ])
      ]));
    }

    /* Código y nombre que no concuerdan: los datos se han importado por código,
       pero conviene mirarlo antes de fiarse del informe. */
    if (res.discrepancias.length) {
      bloque.appendChild(el('div', { class: 'aviso error' }, [
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

    return bloque;
  }

  function zonaCarga(fuente) {
    var input = el('input', {
      type: 'file',
      accept: '.csv,.tsv,.txt,.xlsx',
      onChange: function (e) {
        if (e.target.files && e.target.files[0]) { manejar(e.target.files[0]); }
        e.target.value = '';
      }
    });

    function manejar(file) {
      ultimaCarga[fuente.id] = { leyendo: true, fichero: file.name };
      App.render();

      procesar(fuente, file, function (err, res) {
        if (err) {
          ultimaCarga[fuente.id] = { error: err.message, fichero: file.name };
          App.ui.flotante('No se pudo importar ' + file.name, true);
        } else {
          ultimaCarga[fuente.id] = { res: res, fichero: file.name };
          App.ui.flotante(res.filasImportadas + ' municipios importados en «' + fuente.titulo + '»');
        }
        App.render();
      });
    }

    var zona = el('div', {
      class: 'zona-carga',
      tabindex: '0',
      role: 'button',
      'aria-label': 'Cargar fichero de ' + fuente.titulo,
      onClick: function () { input.click(); },
      onKeydown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      },
      onDragover: function (e) { e.preventDefault(); zona.classList.add('encima'); },
      onDragleave: function () { zona.classList.remove('encima'); },
      onDrop: function (e) {
        e.preventDefault();
        zona.classList.remove('encima');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) { manejar(e.dataTransfer.files[0]); }
      }
    }, [
      el('div', { class: 'icono-zona' }, [icono(fuente.icono, 24)]),
      el('h3', { text: fuente.titulo }),
      el('p', { class: 'pista', text: 'Arrastre el CSV o Excel aquí, o pulse para seleccionarlo' }),
      input
    ]);

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono(fuente.icono), fuente.titulo]),
        resumenCarga(fuente)
      ]),
      el('p', { class: 'silencio', text: fuente.descripcion }),
      el('p', { class: 'silencio', style: 'margin-top:6px', text: 'Formato esperado — ' + fuente.formato }),
      el('div', { style: 'margin-top:18px' }, [zona]),
      avisosDeCarga(fuente)
    ]);
  }

  /* Tabla de comprobación: qué hay cargado ahora mismo, municipio a municipio. */
  function tablaEstadoDatos() {
    var estado = App.store.estado();
    var filas = App.geo.MUNICIPIOS.map(function (m) {
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
    });

    var conDatos = filas.filter(function (f) { return f.mesas || f.reps || f.policia; });
    var cuerpo = el('tbody');

    (conDatos.length ? conDatos : []).forEach(function (f) {
      cuerpo.appendChild(el('tr', {}, [
        el('td', { class: 'num', text: f.m.codigo }),
        el('td', { text: f.m.nombre }),
        el('td', { text: App.geo.isla(f.m.isla).nombre }),
        el('td', { class: 'n', text: App.ui.numero(f.mesas) }),
        el('td', { class: 'n', text: App.ui.numero(f.reps) }),
        el('td', { class: 'n', text: App.ui.numero(f.policia) })
      ]));
    });

    var totales = conDatos.reduce(function (a, f) {
      a.mesas += f.mesas; a.reps += f.reps; a.policia += f.policia;
      return a;
    }, { mesas: 0, reps: 0, policia: 0 });

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('documento'), 'Datos cargados']),
        el('div', { class: 'fila' }, [
          el('span', {
            class: 'silencio',
            text: conDatos.length + ' de ' + App.geo.MUNICIPIOS.length + ' municipios con datos'
          }),
          el('button', {
            class: 'btn secundario pequeno',
            onClick: descargarPlantillas
          }, [icono('descarga', 14), 'Plantillas CSV'])
        ])
      ]),
      conDatos.length
        ? el('div', { class: 'tabla-scroll', style: 'max-height:420px;overflow-y:auto' }, [
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
        : el('p', {
            class: 'sin-datos',
            text: 'Todavía no hay datos cargados. Empiece por las mesas: sin ellas no hay cálculo posible.'
          })
    ]);
  }

  function descargarPlantillas() {
    var cabeceraMesas = [['MUNICIPIO', 'MESAS']];
    var cabeceraPolicia = [['MUNICIPIO', 'EFECTIVOS']];
    var cabeceraReps = [['MUNICIPIOS'].concat(App.store.TIPOLOGIAS_PD)];

    App.geo.MUNICIPIOS.forEach(function (m) {
      var etiqueta = m.codigo + ' ' + m.nombre;
      cabeceraMesas.push([etiqueta, '']);
      cabeceraPolicia.push([etiqueta, '']);
      cabeceraReps.push([etiqueta, '', '', '', '', '', '']);
    });

    App.ui.descargar('plantilla-mesas.csv', App.ui.aCSV(cabeceraMesas));
    setTimeout(function () {
      App.ui.descargar('plantilla-representantes.csv', App.ui.aCSV(cabeceraReps));
    }, 300);
    setTimeout(function () {
      App.ui.descargar('plantilla-policia.csv', App.ui.aCSV(cabeceraPolicia));
    }, 600);
    App.ui.flotante('Descargando las tres plantillas con los 88 municipios');
  }

  function nombreCopia() {
    var conv = App.store.estado().convocatoria || 'proceso';
    var limpio = App.geo.normaliza(conv).replace(/ /g, '-') || 'proceso';
    return 'gastos-' + limpio + '-' + new Date().toISOString().slice(0, 10) + '.json';
  }

  function exportarCopia() {
    App.ui.descargar(nombreCopia(), JSON.stringify(App.store.exportar(), null, 2), 'application/json');
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
    return FUENTES.some(function (f) { return cuantosDatos(f.id) > 0; });
  }

  /* Vaciar los datos sin tocar las tarifas: es el gesto de cerrar una
     convocatoria y abrir la siguiente, donde los censos cambian enteros pero los
     importes se suelen retocar, no rehacer. */
  function borrarTodosLosDatos() {
    var detalle = FUENTES
      .filter(function (f) { return cuantosDatos(f.id) > 0; })
      .map(function (f) { return '· ' + f.titulo + ': ' + cuantosDatos(f.id) + ' municipios'; })
      .join('\n');

    if (!window.confirm(
      'Se borrarán todos los censos cargados:\n\n' + detalle + '\n\n' +
      'Las tarifas de la configuración se conservan.\n\n' +
      'Si aún no ha exportado una copia de esta convocatoria, cancele y expórtela primero.\n¿Continuar?'
    )) { return; }

    App.store.muta(function (s) {
      FUENTES.forEach(function (f) { f.limpiar(s); });
      s.cargas = {};
    });
    FUENTES.forEach(function (f) { delete ultimaCarga[f.id]; });
    App.ui.flotante('Censos borrados. Las tarifas siguen configuradas.');
    App.render();
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
        el('button', { class: 'btn secundario', onClick: exportarCopia },
          [icono('descarga', 16), 'Exportar copia (JSON)']),
        botonRestaurar(),
        el('button', {
          class: 'btn peligro',
          disabled: !hayDatos(),
          onClick: borrarTodosLosDatos
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
            if (window.confirm(
              'Se borrarán las tarifas Y todos los censos, dejando la aplicación como recién instalada.\n\n' +
              '¿Continuar?'
            )) {
              App.store.reiniciar();
              FUENTES.forEach(function (f) { delete ultimaCarga[f.id]; });
              App.ui.flotante('Aplicación reiniciada por completo');
              App.render();
            }
          }
        }, 'Reiniciar también las tarifas')
      ])
    ]);
  }

  App.vistas = App.vistas || {};
  App.vistas.datos = {
    titulo: 'Carga de Datos',
    subtitulo: 'Actualice los censos del proceso. Los ficheros pueden ser CSV o Excel (.xlsx) y se reconocen los municipios por código o por nombre.',
    render: function () {
      return el('div', { class: 'apilar', style: 'gap:24px' }, [
        el('div', { class: 'rejilla tres' }, FUENTES.map(zonaCarga)),
        tablaEstadoDatos(),
        tarjetaConvocatoria()
      ]);
    }
  };
})(window.App = window.App || {});
