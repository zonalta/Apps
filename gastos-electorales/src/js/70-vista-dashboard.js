/* Vista "Dashboard de Informes": filtros, indicadores, gráficas y tablas. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;
  var euro = App.ui.euro;
  var numero = App.ui.numero;

  /* Los filtros viven en memoria durante la sesión: son una consulta, no un dato
     del proceso electoral, así que no se persisten con el resto del estado. */
  var filtros = null;

  function filtrosPorDefecto() {
    return {
      provincias: App.geo.PROVINCIAS.map(function (p) { return p.id; }),
      islas: App.geo.ISLAS.map(function (i) { return i.id; }),
      municipios: App.geo.MUNICIPIOS.map(function (m) { return m.codigo; }),
      tipos: App.store.COLABORADORES.map(function (c) { return c.id; }),
      soloActivos: true,
      busquedaMunicipio: '',
      busquedaTabla: '',
      pestana: 'municipio',
      /* Orden de la tabla de desglose, por pestaña: { columna, direccion }.
         Sin entrada para una pestaña se usa su orden por defecto. */
      orden: {}
    };
  }

  function estadoFiltros() {
    if (!filtros) { filtros = filtrosPorDefecto(); }
    return filtros;
  }

  /* ---------- Controles de selección ---------- */

  function alterna(lista, valor, activo) {
    var i = lista.indexOf(valor);
    if (activo && i < 0) { lista.push(valor); }
    if (!activo && i >= 0) { lista.splice(i, 1); }
  }

  function checklist(opciones) {
    var f = estadoFiltros();
    var lista = el('div', { class: 'lista-check' + (opciones.corta ? ' corta' : '') });

    opciones.items.forEach(function (item) {
      var marcado = opciones.seleccion.indexOf(item.id) >= 0;
      lista.appendChild(el('label', { class: 'opcion-check' }, [
        el('input', {
          type: 'checkbox',
          checked: marcado,
          onChange: function (e) {
            opciones.alCambiar(item.id, e.target.checked);
            App.render();
          }
        }),
        el('span', { class: 'texto', text: item.nombre }),
        item.meta ? el('span', { class: 'meta', text: item.meta }) : null
      ]));
    });

    if (!opciones.items.length) {
      lista.appendChild(el('p', { class: 'silencio', style: 'padding:12px', text: 'Nada que mostrar con la selección de arriba.' }));
    }

    var bloque = el('div', { class: 'grupo-filtro' }, [
      el('div', { class: 'titulo-filtro' }, [
        el('strong', { text: opciones.titulo }),
        el('span', {
          class: 'cuenta',
          text: opciones.seleccion.filter(function (id) {
            return opciones.items.some(function (it) { return it.id === id; });
          }).length + ' / ' + opciones.items.length
        })
      ]),
      el('div', { class: 'acciones-filtro' }, [
        el('button', {
          type: 'button',
          onClick: function () { opciones.alTodos(true); App.render(); }
        }, 'Todos'),
        el('button', {
          type: 'button',
          onClick: function () { opciones.alTodos(false); App.render(); }
        }, 'Ninguno')
      ])
    ]);

    if (opciones.buscador) {
      bloque.appendChild(el('input', {
        type: 'search',
        placeholder: 'Buscar municipio…',
        value: f.busquedaMunicipio,
        style: 'margin-bottom:8px',
        onInput: function (e) {
          f.busquedaMunicipio = e.target.value;
          App.render({ foco: 'buscador-municipio' });
        },
        id: 'buscador-municipio'
      }));
    }

    bloque.appendChild(lista);
    return bloque;
  }

  function panelFiltros() {
    var f = estadoFiltros();
    var estado = App.store.estado();

    var islasVisibles = App.geo.ordenarPorNombre(App.geo.ISLAS.filter(function (i) {
      return f.provincias.indexOf(i.provincia) >= 0;
    }));

    var termino = App.geo.normaliza(f.busquedaMunicipio);
    var municipiosVisibles = App.geo.ordenarPorNombre(App.geo.MUNICIPIOS.filter(function (m) {
      if (f.islas.indexOf(m.isla) < 0) { return false; }
      if (f.provincias.indexOf(m.provincia) < 0) { return false; }
      if (termino && App.geo.normaliza(m.nombre).indexOf(termino) < 0 &&
          m.codigo.indexOf(termino) < 0) { return false; }
      return true;
    }));

    /* Al desmarcar un ámbito superior se arrastra lo que cuelga de él, para que
       los contadores del panel no mientan. */
    function cascadaProvincia(id, activo) {
      alterna(f.provincias, id, activo);
      App.geo.islasDe(id).forEach(function (isla) {
        alterna(f.islas, isla.id, activo);
        App.geo.municipiosDe(isla.id).forEach(function (m) {
          alterna(f.municipios, m.codigo, activo);
        });
      });
    }

    function cascadaIsla(id, activo) {
      alterna(f.islas, id, activo);
      App.geo.municipiosDe(id).forEach(function (m) {
        alterna(f.municipios, m.codigo, activo);
      });
      if (activo) { alterna(f.provincias, App.geo.isla(id).provincia, true); }
    }

    return el('aside', { class: 'panel-filtros no-imprimir' }, [
      el('div', { class: 'entre' }, [
        el('h2', { text: 'Filtros de informe' }),
        el('button', {
          class: 'btn fantasma pequeno',
          title: 'Restablecer todos los filtros',
          onClick: function () { filtros = filtrosPorDefecto(); App.render(); }
        }, 'Reiniciar')
      ]),

      checklist({
        titulo: 'Provincia',
        items: App.geo.PROVINCIAS.map(function (p) { return { id: p.id, nombre: p.nombre }; }),
        seleccion: f.provincias,
        corta: true,
        alCambiar: cascadaProvincia,
        alTodos: function (v) {
          App.geo.PROVINCIAS.forEach(function (p) { cascadaProvincia(p.id, v); });
        }
      }),

      checklist({
        titulo: 'Isla',
        items: islasVisibles.map(function (i) { return { id: i.id, nombre: i.nombre }; }),
        seleccion: f.islas,
        corta: true,
        alCambiar: cascadaIsla,
        alTodos: function (v) {
          islasVisibles.forEach(function (i) { cascadaIsla(i.id, v); });
        }
      }),

      checklist({
        titulo: 'Municipio',
        buscador: true,
        items: municipiosVisibles.map(function (m) {
          var mesas = Number(estado.mesas[m.codigo]) || 0;
          return {
            id: m.codigo,
            nombre: m.nombre,
            meta: mesas ? mesas + ' mesas' : '—'
          };
        }),
        seleccion: f.municipios,
        alCambiar: function (id, activo) { alterna(f.municipios, id, activo); },
        alTodos: function (v) {
          municipiosVisibles.forEach(function (m) { alterna(f.municipios, m.codigo, v); });
        }
      }),

      checklist({
        titulo: 'Colaboradores',
        items: App.store.COLABORADORES.map(function (c) {
          return { id: c.id, nombre: c.nombre, meta: c.agregable ? null : 'aparte' };
        }),
        seleccion: f.tipos,
        corta: true,
        alCambiar: function (id, activo) { alterna(f.tipos, id, activo); },
        alTodos: function (v) {
          App.store.COLABORADORES.forEach(function (c) { alterna(f.tipos, c.id, v); });
        }
      }),

      el('label', { class: 'opcion-check', style: 'border:1px solid var(--outline);border-radius:4px' }, [
        el('input', {
          type: 'checkbox',
          checked: f.soloActivos,
          onChange: function (e) { f.soloActivos = e.target.checked; App.render(); }
        }),
        el('span', { class: 'texto', text: 'Sólo municipios con mesas' })
      ])
    ]);
  }

  /* ---------- Indicadores ---------- */

  function kpis(informe) {
    var costeMesa = informe.totalMesas ? informe.totalTerritorial / informe.totalMesas : 0;

    function tarjeta(etiqueta, valor, nota, destacado) {
      return el('div', { class: 'tarjeta kpi' }, [
        el('span', { class: 'etiqueta', text: etiqueta }),
        el('span', { class: 'valor num' + (destacado ? ' destacado' : ''), text: valor }),
        el('span', { class: 'nota', text: nota })
      ]);
    }

    return el('div', { class: 'rejilla cuatro' }, [
      tarjeta('Coste total', App.ui.euroCorto(informe.total),
        informe.incluyeCoordinadores
          ? 'Incluye ' + euro(informe.coordinadores.total) + ' de coordinadores'
          : 'Coordinadores no incluidos en la selección',
        true),
      tarjeta('Mesas electorales', numero(informe.totalMesas),
        informe.totalMesas ? euro(costeMesa) + ' por mesa' : 'Sin mesas cargadas'),
      tarjeta('Municipios', numero(informe.porMunicipio.length),
        'de ' + numero(App.geo.MUNICIPIOS.length) + ' en Canarias'),
      tarjeta('Tipologías', numero(informe.tipos.length),
        'de ' + App.store.COLABORADORES.length + ' colaboradores')
    ]);
  }

  /* ---------- Gráficas ---------- */

  function graficas(informe) {
    var porTipo = App.store.COLABORADORES
      .filter(function (c) { return c.agregable && informe.tipos.indexOf(c.id) >= 0; })
      .map(function (c) {
        return { etiqueta: c.nombre, valor: informe.totalPorTipo[c.id] };
      });

    var porProvincia = informe.porProvincia.map(function (p) {
      return { etiqueta: p.nombre, valor: p.importe };
    });

    var porIsla = informe.porIsla.map(function (i) {
      return { etiqueta: i.nombre, valor: i.importe };
    });

    return el('div', { class: 'rejilla principal-lateral' }, [
      el('section', { class: 'tarjeta' }, [
        el('header', {}, [
          el('h2', { text: 'Gasto por tipo de colaborador' }),
          el('span', { class: 'silencio', text: 'Total repartible: ' + euro(informe.totalTerritorial) })
        ]),
        App.ui.barras(porTipo),
        informe.incluyeCoordinadores && informe.coordinadores.total > 0
          ? el('p', {
              class: 'leyenda-nota',
              text: 'Los coordinadores de tablets (' + euro(informe.coordinadores.total) +
                ') no aparecen en esta gráfica porque no se reparten por territorio. ' +
                'Sí están incluidos en el coste total.'
            })
          : null
      ]),
      el('div', { class: 'apilar', style: 'gap:24px' }, [
        el('section', { class: 'tarjeta' }, [
          el('header', {}, [el('h2', { text: 'Por provincia' })]),
          App.ui.barras(porProvincia, { compacta: true })
        ]),
        el('section', { class: 'tarjeta' }, [
          el('header', {}, [el('h2', { text: 'Por isla' })]),
          App.ui.barras(porIsla, { compacta: true })
        ])
      ])
    ]);
  }

  /* ---------- Tablas ---------- */

  var PESTANAS = [
    { id: 'municipio', nombre: 'Por municipio' },
    { id: 'isla', nombre: 'Por isla' },
    { id: 'provincia', nombre: 'Por provincia' },
    { id: 'colaborador', nombre: 'Por colaborador' },
    { id: 'detalle', nombre: 'Detalle línea a línea' }
  ];

  /* Cada constructor devuelve { columnas, filas, totales } en un formato común,
     de modo que el pintado y la exportación a CSV se escriben una sola vez. */
  function datosTabla(informe, pestana, termino) {
    var tiposAgregables = App.store.COLABORADORES.filter(function (c) {
      return c.agregable && informe.tipos.indexOf(c.id) >= 0;
    });

    function coincide(txt) {
      if (!termino) { return true; }
      return App.geo.normaliza(txt).indexOf(termino) >= 0;
    }

    if (pestana === 'municipio') {
      var columnas = [
        { clave: 'codigo', nombre: 'Código' },
        { clave: 'nombre', nombre: 'Municipio' },
        { clave: 'isla', nombre: 'Isla' },
        { clave: 'mesas', nombre: 'Mesas', num: true }
      ].concat(tiposAgregables.map(function (c) {
        return { clave: c.id, nombre: c.nombre, num: true, dinero: true };
      })).concat([{ clave: 'subtotal', nombre: 'Subtotal', num: true, dinero: true, fuerte: true }]);

      var filas = informe.porMunicipio
        .filter(function (m) { return coincide(m.nombre + ' ' + m.codigo); })
        .sort(function (a, b) { return b.subtotal - a.subtotal; })
        .map(function (m) {
          var fila = {
            codigo: m.codigo, nombre: m.nombre, isla: m.islaNombre,
            mesas: m.mesas, subtotal: m.subtotal
          };
          tiposAgregables.forEach(function (c) {
            fila[c.id] = m.lineas[c.id] ? m.lineas[c.id].importe : 0;
          });
          return fila;
        });

      var totales = { codigo: '', nombre: 'Total', isla: '', mesas: 0, subtotal: 0 };
      tiposAgregables.forEach(function (c) { totales[c.id] = 0; });
      filas.forEach(function (f) {
        totales.mesas += f.mesas;
        totales.subtotal += f.subtotal;
        tiposAgregables.forEach(function (c) { totales[c.id] += f[c.id]; });
      });
      return { columnas: columnas, filas: filas, totales: totales };
    }

    if (pestana === 'isla' || pestana === 'provincia') {
      var origen = pestana === 'isla' ? informe.porIsla : informe.porProvincia;
      var lista = origen.filter(function (g) { return coincide(g.nombre); });
      return {
        columnas: [
          { clave: 'nombre', nombre: pestana === 'isla' ? 'Isla' : 'Provincia' },
          { clave: 'municipios', nombre: 'Municipios', num: true },
          { clave: 'mesas', nombre: 'Mesas', num: true },
          { clave: 'importe', nombre: 'Importe', num: true, dinero: true, fuerte: true },
          { clave: 'peso', nombre: '% del total', num: true }
        ],
        filas: lista.map(function (g) {
          return {
            nombre: g.nombre, municipios: g.municipios, mesas: g.mesas, importe: g.importe,
            peso: App.ui.porcentaje(g.importe, informe.totalTerritorial)
          };
        }),
        totales: {
          nombre: 'Total',
          municipios: lista.reduce(function (a, g) { return a + g.municipios; }, 0),
          mesas: lista.reduce(function (a, g) { return a + g.mesas; }, 0),
          importe: lista.reduce(function (a, g) { return a + g.importe; }, 0),
          peso: ''
        }
      };
    }

    if (pestana === 'colaborador') {
      var filasC = App.store.COLABORADORES
        .filter(function (c) { return informe.tipos.indexOf(c.id) >= 0; })
        .filter(function (c) { return coincide(c.nombre); })
        .map(function (c) {
          if (!c.agregable) {
            return {
              nombre: c.nombre,
              cantidad: informe.coordinadores.hasta10.cantidad + informe.coordinadores.desde11.cantidad,
              unidad: 'coordinadores',
              importe: informe.coordinadores.total,
              ambito: 'Global (no territorializado)'
            };
          }
          var unidad = '';
          informe.porMunicipio.some(function (m) {
            if (m.lineas[c.id]) { unidad = m.lineas[c.id].unidad; return true; }
            return false;
          });
          return {
            nombre: c.nombre,
            cantidad: informe.cantidadPorTipo[c.id],
            unidad: unidad,
            importe: informe.totalPorTipo[c.id],
            ambito: 'Reparto territorial'
          };
        });

      return {
        columnas: [
          { clave: 'nombre', nombre: 'Colaborador' },
          { clave: 'cantidad', nombre: 'Cantidad', num: true },
          { clave: 'unidad', nombre: 'Unidad' },
          { clave: 'ambito', nombre: 'Ámbito' },
          { clave: 'importe', nombre: 'Importe', num: true, dinero: true, fuerte: true }
        ],
        filas: filasC,
        totales: {
          nombre: 'Total', cantidad: '', unidad: '', ambito: '',
          importe: filasC.reduce(function (a, f) { return a + f.importe; }, 0)
        }
      };
    }

    /* detalle: una línea por municipio y tipología, como en el prototipo. */
    var detalle = [];
    informe.porMunicipio.forEach(function (m) {
      if (!coincide(m.nombre + ' ' + m.codigo)) { return; }
      tiposAgregables.forEach(function (c) {
        var l = m.lineas[c.id];
        if (!l || (!l.importe && !l.cantidad)) { return; }
        detalle.push({
          municipio: m.nombre,
          isla: m.islaNombre,
          colaborador: c.nombre,
          unitario: l.importeUnitario,
          cantidad: l.cantidad,
          unidad: l.unidad,
          importe: l.importe
        });
      });
    });

    return {
      columnas: [
        { clave: 'municipio', nombre: 'Municipio' },
        { clave: 'isla', nombre: 'Isla' },
        { clave: 'colaborador', nombre: 'Colaborador' },
        { clave: 'unitario', nombre: 'Imp. unitario', num: true, dinero: true },
        { clave: 'cantidad', nombre: 'Cantidad', num: true },
        { clave: 'unidad', nombre: 'Unidad' },
        { clave: 'importe', nombre: 'Subtotal', num: true, dinero: true, fuerte: true }
      ],
      filas: detalle,
      totales: {
        municipio: 'Total', isla: '', colaborador: '', unitario: '', cantidad: '', unidad: '',
        importe: detalle.reduce(function (a, f) { return a + f.importe; }, 0)
      }
    };
  }

  function formatearCelda(col, valor) {
    if (valor === '' || valor == null) { return ''; }
    if (col.dinero) { return euro(valor); }
    if (col.num && typeof valor === 'number') { return numero(valor); }
    return String(valor);
  }

  /* Al pulsar una cabecera se ordena por esa columna; al volver a pulsar la
     misma se invierte el sentido. Cada pestaña recuerda su propio orden, y sin
     elegir ninguno se mantiene el orden por defecto de datosTabla. */
  function alternarOrden(f, clave, esNumero) {
    var actual = f.orden[f.pestana];
    if (actual && actual.clave === clave) {
      f.orden[f.pestana] = { clave: clave, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
    } else {
      f.orden[f.pestana] = { clave: clave, direccion: esNumero ? 'desc' : 'asc' };
    }
  }

  function ordenarFilas(filas, columnas, ordenActivo, pestana) {
    if (!ordenActivo) { return filas; }

    /* Al ordenar el desglose "Por municipio" por isla, dentro de cada isla los
       municipios se esperan en orden alfabético. Se consigue pre-ordenando por
       nombre y ordenando después por isla con un sort estable: los empates
       (mismos municipios de una isla) conservan ese orden alfabético previo. */
    var base = (pestana === 'municipio' && ordenActivo.clave === 'isla')
      ? App.geo.ordenarPorNombre(filas)
      : filas;

    var col = columnas.filter(function (c) { return c.clave === ordenActivo.clave; })[0];
    var dir = ordenActivo.direccion === 'asc' ? 1 : -1;
    return base.slice().sort(function (a, b) {
      var va = a[ordenActivo.clave];
      var vb = b[ordenActivo.clave];
      if (col && col.num) { return ((Number(va) || 0) - (Number(vb) || 0)) * dir; }
      return App.geo.compararNombres(va == null ? '' : va, vb == null ? '' : vb) * dir;
    });
  }

  function tablaInforme(informe) {
    var f = estadoFiltros();
    var termino = App.geo.normaliza(f.busquedaTabla);
    var datos = datosTabla(informe, f.pestana, termino);
    var ordenActivo = f.orden[f.pestana];
    datos.filas = ordenarFilas(datos.filas, datos.columnas, ordenActivo, f.pestana);

    var cuerpo = el('tbody');
    datos.filas.forEach(function (fila) {
      cuerpo.appendChild(el('tr', {}, datos.columnas.map(function (col) {
        return el('td', {
          class: col.num ? 'n' : null,
          style: col.fuerte ? 'font-weight:600' : null,
          text: formatearCelda(col, fila[col.clave])
        });
      })));
    });

    var tabla = el('table', {}, [
      el('thead', {}, [
        el('tr', {}, datos.columnas.map(function (col) {
          var activa = ordenActivo && ordenActivo.clave === col.clave;
          return el('th', {
            class: col.num ? 'n' : null,
            title: 'Ordenar por ' + col.nombre,
            style: 'cursor:pointer;user-select:none',
            onClick: function () { alternarOrden(f, col.clave, col.num); App.render(); }
          }, [
            col.nombre,
            activa ? el('span', { style: 'margin-left:4px', text: ordenActivo.direccion === 'asc' ? '▲' : '▼' }) : null
          ]);
        }))
      ]),
      cuerpo,
      el('tfoot', {}, [
        el('tr', {}, datos.columnas.map(function (col) {
          return el('td', {
            class: col.num ? 'n' : null,
            text: formatearCelda(col, datos.totales[col.clave])
          });
        }))
      ])
    ]);

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', { text: 'Desglose del informe' }),
        el('div', { class: 'fila no-imprimir' }, [
          el('input', {
            type: 'search',
            id: 'buscador-tabla',
            placeholder: 'Filtrar…',
            value: f.busquedaTabla,
            style: 'width:180px',
            onInput: function (e) {
              f.busquedaTabla = e.target.value;
              App.render({ foco: 'buscador-tabla' });
            }
          }),
          el('button', {
            class: 'btn secundario pequeno',
            onClick: function () {
              var filas = [datos.columnas.map(function (c) { return c.nombre; })];
              datos.filas.forEach(function (fila) {
                filas.push(datos.columnas.map(function (c) {
                  var v = fila[c.clave];
                  return typeof v === 'number' ? String(v).replace('.', ',') : (v == null ? '' : v);
                }));
              });
              App.ui.descargar('informe-' + f.pestana + '.csv', App.ui.aCSV(filas));
              App.ui.flotante('CSV descargado');
            }
          }, [icono('descarga', 14), 'CSV'])
        ])
      ]),
      el('div', { class: 'pestanas no-imprimir', role: 'tablist', style: 'margin-bottom:16px' },
        PESTANAS.map(function (p) {
          return el('button', {
            role: 'tab',
            'aria-selected': String(f.pestana === p.id),
            onClick: function () { f.pestana = p.id; App.render(); }
          }, p.nombre);
        })
      ),
      datos.filas.length
        ? el('div', { class: 'tabla-scroll alta' }, [tabla])
        : el('p', { class: 'sin-datos', text: 'No hay líneas que mostrar con los filtros actuales.' })
    ]);
  }

  /* ---------- Coordinadores, siempre aparte ---------- */

  function tarjetaCoordinadores(informe) {
    if (!informe.incluyeCoordinadores) { return null; }
    var c = informe.coordinadores;

    function linea(nombre, dato) {
      return el('tr', {}, [
        el('td', { text: nombre }),
        el('td', { class: 'n', text: numero(dato.cantidad) }),
        el('td', { class: 'n', text: euro(dato.importeUnitario) }),
        el('td', { class: 'n', style: 'font-weight:600', text: euro(dato.importe) })
      ]);
    }

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('tableta'), 'Coordinadores de tablets']),
        el('span', { class: 'chip aviso', text: 'Importe independiente' })
      ]),
      el('p', {
        class: 'silencio',
        text: 'No se reparte por municipio, isla ni provincia. Se suma únicamente al coste total del informe.'
      }),
      el('div', { class: 'tabla-scroll', style: 'margin-top:16px' }, [
        el('table', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Tramo de colegio' }),
              el('th', { class: 'n', text: 'Coordinadores' }),
              el('th', { class: 'n', text: 'Imp. unitario' }),
              el('th', { class: 'n', text: 'Importe' })
            ])
          ]),
          el('tbody', {}, [
            linea('Colegios de hasta 10 mesas', c.hasta10),
            linea('Colegios de 11 mesas o más', c.desde11)
          ]),
          el('tfoot', {}, [
            el('tr', {}, [
              el('td', { text: 'Total' }),
              el('td', { class: 'n', text: numero(c.hasta10.cantidad + c.desde11.cantidad) }),
              el('td', {}),
              el('td', { class: 'n', text: euro(c.total) })
            ])
          ])
        ])
      ])
    ]);
  }

  /* ---------- Cabecera del informe y exportación ---------- */

  function resumenAmbito(informe) {
    var f = estadoFiltros();
    var partes = [];

    var todasProv = f.provincias.length === App.geo.PROVINCIAS.length;
    partes.push(todasProv
      ? 'Todas las provincias'
      : f.provincias.map(function (id) { return App.geo.provincia(id).nombre; }).join(', ') || 'Ninguna provincia');

    var islasEnAmbito = App.geo.ISLAS.filter(function (i) { return f.provincias.indexOf(i.provincia) >= 0; });
    var islasSel = islasEnAmbito.filter(function (i) { return f.islas.indexOf(i.id) >= 0; });
    partes.push(islasSel.length === islasEnAmbito.length
      ? 'todas las islas'
      : islasSel.map(function (i) { return i.nombre; }).join(', ') || 'ninguna isla');

    partes.push(numero(informe.porMunicipio.length) + ' municipios');
    partes.push(numero(informe.tipos.length) + ' de ' + App.store.COLABORADORES.length + ' tipologías');
    if (f.soloActivos) { partes.push('sólo municipios con mesas'); }

    return partes.join(' · ');
  }

  /* Construye el informe como documento suelto, con el mismo aspecto que tendría
     impreso. Hace falta porque dentro de un iframe con sandbox el navegador
     ignora window.print(): allí se abre en una pestaña propia, donde el usuario
     ya puede imprimir o guardar como PDF con normalidad. */
  function documentoImprimible() {
    var estilos = '';
    document.querySelectorAll('style').forEach(function (s) { estilos += s.textContent; });

    var copia = document.querySelector('.contenido').cloneNode(true);
    copia.querySelectorAll('.no-imprimir').forEach(function (n) { n.remove(); });
    copia.querySelectorAll('.tabla-scroll').forEach(function (n) {
      n.classList.remove('alta');
      n.style.maxHeight = 'none';
      n.style.overflow = 'visible';
    });

    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + (App.store.estado().convocatoria || 'Informe de gastos') + '</title>' +
      '<style>' + estilos +
      /* En el documento suelto lo de impresión se ve también en pantalla. */
      '.solo-impresion{display:block !important}' +
      'body{background:#fff;padding:24px}' +
      '.contenido{max-width:none;padding:0}' +
      '</style></head><body>' + copia.outerHTML + '</body></html>';
  }

  function exportarPDF() {
    if (!App.ui.enMarco()) {
      window.print();
      return;
    }

    /* Vista previa dentro de un marco: se abre el informe aparte. */
    var blob = new Blob([documentoImprimible()], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var ventana = window.open(url, '_blank');

    if (ventana) {
      App.ui.flotante('Informe abierto en una pestaña nueva. Use Imprimir → Guardar como PDF.');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return;
    }

    /* Sin permiso para abrir pestañas, queda descargarlo. */
    URL.revokeObjectURL(url);
    App.ui.descargar(
      'informe-' + new Date().toISOString().slice(0, 10) + '.html',
      documentoImprimible(),
      'text/html'
    );
    App.ui.flotante('Informe descargado en HTML. Ábralo y use Imprimir → Guardar como PDF.');
  }

  function cabeceraInforme(informe) {
    var estado = App.store.estado();

    return el('div', {}, [
      /* Cabecera visible sólo al imprimir o exportar a PDF. */
      el('div', { class: 'solo-impresion cabecera-impresion' }, [
        el('h1', { text: 'Informe de gastos — ' + estado.convocatoria }),
        el('p', { class: 'meta', text: 'Generado el ' + App.ui.fecha(informe.generadoEn) }),
        el('p', { class: 'meta', text: 'Ámbito: ' + resumenAmbito(informe) })
      ]),

      el('div', { class: 'entre no-imprimir', style: 'margin-bottom:24px' }, [
        el('div', {}, [
          el('h1', { text: 'Informe general de gastos' }),
          el('p', {
            style: 'color:var(--on-surface-variant);margin-top:6px',
            text: estado.convocatoria + ' · Generado el ' + App.ui.fecha(informe.generadoEn)
          }),
          el('p', { class: 'silencio', style: 'margin-top:4px', text: resumenAmbito(informe) })
        ]),
        el('div', { class: 'fila' }, [
          el('button', {
            class: 'btn',
            onClick: exportarPDF
          }, [icono('imprimir', 16), 'Exportar a PDF'])
        ])
      ])
    ]);
  }

  function sinDatos() {
    return el('section', { class: 'tarjeta' }, [
      el('div', { class: 'aviso' }, [
        icono('aviso'),
        el('div', {}, [
          el('strong', { text: 'Todavía no hay mesas cargadas. ' }),
          'El número de mesas por municipio es la base de casi todos los cálculos. ' +
          'Vaya a «Carga de Datos», descargue la plantilla CSV con los 88 municipios y súbala rellena.'
        ])
      ]),
      el('div', { class: 'fila', style: 'margin-top:18px' }, [
        el('button', {
          class: 'btn',
          onClick: function () { App.irA('datos'); }
        }, [icono('carga', 16), 'Ir a Carga de Datos'])
      ])
    ]);
  }

  App.vistas = App.vistas || {};
  App.vistas.dashboard = {
    titulo: 'Dashboard de Informes',
    panelLateral: panelFiltros,
    render: function () {
      var estado = App.store.estado();
      var f = estadoFiltros();
      var hayMesas = Object.keys(estado.mesas).some(function (k) { return estado.mesas[k] > 0; });

      var informe = App.calc.generarInforme(estado, {
        provincias: f.provincias,
        islas: f.islas,
        municipios: f.municipios,
        soloActivos: f.soloActivos
      }, f.tipos);

      App.ultimoInforme = informe;

      return el('div', { class: 'apilar', style: 'gap:24px' }, [
        cabeceraInforme(informe),
        hayMesas ? null : sinDatos(),
        kpis(informe),
        graficas(informe),
        tarjetaCoordinadores(informe),
        tablaInforme(informe)
      ]);
    }
  };
})(window.App = window.App || {});
