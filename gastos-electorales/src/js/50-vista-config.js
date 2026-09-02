/* Vista "Configuración de Importes": define lo que cobra cada tipología. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  /* Campo numérico que escribe directamente en una ruta del estado
     ("config.representantes.PD0"). Devuelve el nodo listo para insertar. */
  function campoImporte(etiqueta, ruta, opciones) {
    opciones = opciones || {};
    var estado = App.store.estado();
    var partes = ruta.split('.');
    var contenedor = estado;
    for (var i = 0; i < partes.length - 1; i++) { contenedor = contenedor[partes[i]]; }
    var clave = partes[partes.length - 1];

    var input = el('input', {
      type: 'number',
      min: '0',
      step: opciones.paso || '0.01',
      value: contenedor[clave],
      'aria-label': etiqueta,
      onInput: function (e) {
        var v = parseFloat(e.target.value);
        App.store.muta(function (s) {
          var c = s;
          for (var j = 0; j < partes.length - 1; j++) { c = c[partes[j]]; }
          c[partes[partes.length - 1]] = isNaN(v) ? 0 : v;
        });
      }
    });

    var envoltorio = opciones.sinEuro
      ? el('div', { class: 'campo-euro sin' }, [input])
      : el('div', { class: 'campo-euro' }, [input]);

    if (opciones.linea) {
      return el('div', { class: 'campo-linea' }, [
        el('label', { text: etiqueta }),
        envoltorio
      ]);
    }
    return el('div', { class: 'campo' }, [
      el('label', { text: etiqueta }),
      envoltorio
    ]);
  }

  function tarjetaRepresentantes() {
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('grupo'), 'Representantes de la Administración'])
      ]),
      el('p', {
        class: 'silencio',
        text: 'Importe por representante y tipología. El gasto de cada municipio es la suma de sus representantes multiplicados por la tarifa de su tipología.'
      }),
      el('div', { class: 'rejilla tres', style: 'margin-top:18px' },
        App.store.TIPOLOGIAS_PD.map(function (t) {
          return campoImporte('Tarifa ' + t + ' (€)', 'config.representantes.' + t);
        })
      )
    ]);
  }

  function tarjetaSecretarios() {
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('identidad'), 'Secretarios de Ayuntamiento'])
      ]),
      el('p', {
        class: 'silencio',
        text: 'Un secretario por municipio. El importe depende del tramo en el que caiga el número de mesas del municipio.'
      }),
      el('div', { class: 'apilar junto', style: 'margin-top:18px' }, [
        campoImporte('Tramo 1 — hasta 10 mesas', 'config.secretarios.hasta10', { linea: true }),
        campoImporte('Tramo 2 — de 11 a 50 mesas', 'config.secretarios.de11a50', { linea: true }),
        campoImporte('Tramo 3 — más de 50 mesas', 'config.secretarios.mas50', { linea: true })
      ])
    ]);
  }

  function tarjetaFijas() {
    var cfg = App.store.estado().config;
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('euro'), 'Tarifas fijas por municipio y por mesa'])
      ]),
      el('div', { class: 'rejilla tres' }, [
        el('div', { class: 'apilar junto' }, [
          el('p', { class: 'silencio', text: 'Importe fijo por municipio' }),
          campoImporte('Jueces de Paz', 'config.juecesPaz', { linea: true })
        ]),
        el('div', { class: 'apilar junto' }, [
          el('p', { class: 'silencio', text: 'Importe por cada mesa del municipio' }),
          campoImporte('Acondicionamiento de locales', 'config.acondicionamiento', { linea: true }),
          campoImporte('Personal colaborador', 'config.personalColaborador', { linea: true }),
          campoImporte('Montaje y transporte', 'config.montajeTransporte', { linea: true })
        ]),
        el('div', { class: 'apilar junto' }, [
          el('p', { class: 'silencio', text: 'Importe por unidad de personal' }),
          campoImporte('Policía — por efectivo', 'config.policia', { linea: true }),
          campoImporte('Miembro de mesa', 'config.miembrosMesa', { linea: true }),
          campoImporte('Miembros por mesa (nº)', 'config.miembrosPorMesa', { linea: true, paso: '1', sinEuro: true })
        ])
      ]),
      el('p', {
        class: 'leyenda-nota',
        text: 'Miembros de mesa: ' + App.ui.euro(cfg.miembrosMesa) + ' × ' +
          cfg.miembrosPorMesa + ' miembros × nº de mesas del municipio.'
      })
    ]);
  }

  function tarjetaCoordinadores() {
    var c = App.store.estado().config.coordinadores;
    var total = App.calc.calcularCoordinadores(App.store.estado());

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('tableta'), 'Coordinadores de tablets'])
      ]),
      el('div', { class: 'aviso' }, [
        icono('aviso'),
        el('div', {}, [
          el('strong', { text: 'Concepto no territorializado. ' }),
          'Los coordinadores están en colegios electorales, y los colegios todavía no se modelan. ' +
          'Por eso su número se introduce aquí como total y su importe se informa siempre por separado: ' +
          'no se reparte entre municipios, islas ni provincias, y sólo entra en el total general.'
        ])
      ]),
      el('div', { class: 'rejilla dos', style: 'margin-top:18px' }, [
        el('div', { class: 'apilar junto' }, [
          el('p', { class: 'silencio', text: 'Colegios de hasta 10 mesas' }),
          campoImporte('Tarifa por coordinador', 'config.coordinadores.tarifaHasta10', { linea: true }),
          campoImporte('Nº de coordinadores', 'config.coordinadores.numHasta10', { linea: true, paso: '1', sinEuro: true })
        ]),
        el('div', { class: 'apilar junto' }, [
          el('p', { class: 'silencio', text: 'Colegios de 11 mesas o más' }),
          campoImporte('Tarifa por coordinador', 'config.coordinadores.tarifaDesde11', { linea: true }),
          campoImporte('Nº de coordinadores', 'config.coordinadores.numDesde11', { linea: true, paso: '1', sinEuro: true })
        ])
      ]),
      el('p', {
        class: 'leyenda-nota',
        text: 'Total coordinadores: ' + App.ui.numero(c.numHasta10 + c.numDesde11) +
          ' personas · ' + App.ui.euro(total.total)
      })
    ]);
  }

  function tarjetaPersonalGobierno() {
    var cfg = App.store.estado().config;
    var total = (Number(cfg.personalDelegacionGobierno) || 0) + (Number(cfg.personalSubdelegacionGobierno) || 0);

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('edificio'), 'Personal de Delegación y Subdelegación del Gobierno'])
      ]),
      el('div', { class: 'aviso' }, [
        icono('aviso'),
        el('div', {}, [
          el('strong', { text: 'Concepto no territorializado. ' }),
          'Igual que los coordinadores de tablets, cada importe se introduce aquí como un total ya cerrado: ' +
          'no se reparte entre municipios, islas ni provincias, y sólo entra en el total general.'
        ])
      ]),
      el('div', { class: 'rejilla dos', style: 'margin-top:18px' }, [
        campoImporte('Personal Delegación del Gobierno', 'config.personalDelegacionGobierno', { linea: true }),
        campoImporte('Personal Subdelegación del Gobierno', 'config.personalSubdelegacionGobierno', { linea: true })
      ]),
      el('p', { class: 'leyenda-nota', text: 'Total: ' + App.ui.euro(total) })
    ]);
  }

  function tarjetaConvocatoria() {
    var estado = App.store.estado();
    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [
        el('h2', {}, [icono('documento'), 'Convocatoria'])
      ]),
      el('div', { class: 'campo' }, [
        el('label', { text: 'Nombre del proceso electoral (aparece en los informes)' }),
        el('input', {
          type: 'text',
          value: estado.convocatoria,
          onInput: function (e) {
            App.store.muta(function (s) { s.convocatoria = e.target.value; });
          }
        })
      ])
    ]);
  }

  /* ---------- Usuarios con acceso ---------- */

  /* null = todavía no se ha pedido; 'cargando'; { administradores, colaboradores,
     esAdmin }; o { error }. Vive fuera del render porque la carga es asíncrona
     y el render de la vista es síncrono: se pide una vez y se repinta al llegar. */
  var usuarios = null;

  /* Editor: acceso completo salvo gestionar usuarios (lo que ya tenía
     «colaborador»). Consulta: sólo el Dashboard de Informes, sin poder
     guardar nada — lo impone el servidor, esto es sólo la etiqueta. */
  var ROL_INFO = {
    editor: { etiqueta: 'Editor', chip: 'pendiente' },
    consulta: { etiqueta: 'Consulta', chip: 'aviso' }
  };

  function cargarUsuarios() {
    usuarios = 'cargando';
    App.api.listarUsuarios()
      .then(function (res) { usuarios = res; App.render(); })
      .catch(function (err) { usuarios = { error: err.message }; App.render(); });
  }

  function darAcceso(correo, rol, input) {
    App.api.darAcceso(correo, rol)
      .then(function (res) {
        usuarios.administradores = res.administradores;
        usuarios.colaboradores = res.colaboradores;
        input.value = '';
        App.ui.flotante('Acceso concedido a ' + correo);
        App.render();
      })
      .catch(function (err) { App.ui.flotante(err.message, true); });
  }

  function quitarAcceso(correo) {
    App.ui.confirmar({
      titulo: 'Quitar el acceso',
      parrafos: ['Se quitará el acceso de ' + correo + ' a esta aplicación. Podrá volver a dárselo cuando quiera.'],
      textoConfirmar: 'Quitar acceso',
      peligro: true,
      alConfirmar: function () {
        App.api.quitarAcceso(correo)
          .then(function (res) {
            usuarios.administradores = res.administradores;
            usuarios.colaboradores = res.colaboradores;
            App.ui.flotante('Acceso retirado');
            App.render();
          })
          .catch(function (err) { App.ui.flotante(err.message, true); });
      }
    });
  }

  function formularioAcceso() {
    var input = el('input', { type: 'text', placeholder: 'correo@gmail.com', 'aria-label': 'Correo a autorizar' });
    var select = el('select', { 'aria-label': 'Papel', style: 'width:auto' }, [
      el('option', { value: 'editor', text: 'Editor — acceso completo' }),
      el('option', { value: 'consulta', text: 'Consulta — solo Dashboard' })
    ]);
    return el('div', {}, [
      el('form', {
        class: 'fila',
        style: 'margin-top:14px',
        onSubmit: function (e) {
          e.preventDefault();
          var correo = input.value.trim();
          if (correo) { darAcceso(correo, select.value, input); }
        }
      }, [
        el('div', { class: 'crece' }, [input]),
        select,
        el('button', { class: 'btn secundario', type: 'submit' }, [icono('grupo', 16), 'Dar acceso'])
      ]),
      el('p', {
        class: 'silencio', style: 'margin-top:6px',
        text: 'Si el correo ya tiene acceso, esto actualiza su papel en vez de duplicarlo.'
      })
    ]);
  }

  function filaUsuario(correo, etiqueta, chipClase, permiteQuitar) {
    return el('div', { class: 'fila-usuario' }, [
      el('span', { class: 'crece', text: correo }),
      el('span', { class: 'chip ' + chipClase, text: etiqueta }),
      permiteQuitar
        ? el('button', {
            class: 'btn peligro pequeno',
            onClick: function () { quitarAcceso(correo); }
          }, [icono('papelera', 14), 'Quitar'])
        : null
    ]);
  }

  function tarjetaUsuarios() {
    /* Sin servidor no hay sesión que gestionar: cada navegador es un mundo. */
    if (App.api.estado().modo !== 'servidor') { return null; }
    if (usuarios === null) { cargarUsuarios(); }

    var cuerpo;
    if (usuarios === 'cargando' || usuarios === null) {
      cuerpo = el('p', { class: 'silencio', text: 'Cargando…' });
    } else if (usuarios.error) {
      cuerpo = el('div', { class: 'aviso error' }, [icono('aviso'), el('div', { text: usuarios.error })]);
    } else {
      var filas = usuarios.administradores.map(function (correo) {
        return filaUsuario(correo, 'Administrador', 'ok', false);
      }).concat(usuarios.colaboradores.map(function (c) {
        var info = ROL_INFO[c.rol] || ROL_INFO.editor;
        return filaUsuario(c.correo, info.etiqueta, info.chip, usuarios.esAdmin);
      }));

      cuerpo = el('div', {}, [
        el('div', { class: 'apilar junto' }, filas),
        usuarios.esAdmin
          ? formularioAcceso()
          : el('p', {
              class: 'silencio', style: 'margin-top:14px',
              text: 'Sólo un administrador puede añadir o quitar el acceso de otras cuentas.'
            })
      ]);
    }

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('identidad'), 'Usuarios con acceso'])]),
      el('p', {
        class: 'silencio',
        text: 'Quién puede entrar con su cuenta de Google. Los administradores se fijan al desplegar el servicio y no se pueden quitar desde aquí. De los colaboradores, un editor tiene acceso completo salvo gestionar usuarios; una cuenta de consulta sólo ve el Dashboard de Informes, sin poder guardar ningún cambio.'
      }),
      cuerpo
    ]);
  }

  /* Qué código y qué revisión de Cloud Run sirven esta pestaña, para comprobar
     sin salir de la aplicación si un cambio recién fusionado ya está en
     producción. Sin servidor (vista previa local) no hay nada que mostrar. */
  function tarjetaVersion() {
    var v = App.api.estado().version;
    if (!v || !v.commit) { return null; }

    function fila(etiqueta, valor) {
      return el('div', { class: 'campo-linea' }, [
        el('label', { text: etiqueta }),
        el('span', { class: 'num', text: valor })
      ]);
    }

    return el('section', { class: 'tarjeta' }, [
      el('header', {}, [el('h2', {}, [icono('documento'), 'Versión desplegada'])]),
      el('div', { class: 'apilar junto' }, [
        fila('Código (commit)', v.commit),
        v.revision ? fila('Revisión de Cloud Run', v.revision) : null
      ])
    ]);
  }

  App.vistas = App.vistas || {};
  App.vistas.configuracion = {
    titulo: 'Configuración de Importes',
    subtitulo: 'Defina los parámetros económicos del proceso. Los cambios se guardan al instante y recalculan todos los informes.',
    render: function () {
      return el('div', { class: 'apilar', style: 'gap:24px' }, [
        tarjetaConvocatoria(),
        el('div', { class: 'rejilla principal-lateral' }, [
          tarjetaRepresentantes(),
          tarjetaSecretarios()
        ]),
        tarjetaFijas(),
        tarjetaCoordinadores(),
        tarjetaPersonalGobierno(),
        tarjetaUsuarios(),
        tarjetaVersion()
      ]);
    }
  };
})(window.App = window.App || {});
