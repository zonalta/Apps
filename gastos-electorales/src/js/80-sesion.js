/* Pantalla de acceso, indicador de sincronización y resolución de conflictos. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  /* ---------- Pantalla de acceso ---------- */

  function pantallaAcceso(mensaje) {
    var cfg = App.api.estado();
    var raiz = document.getElementById('app');
    App.ui.vaciar(raiz);
    raiz.className = 'acceso';

    var contenedorBoton = el('div', { class: 'boton-google' });
    var error = el('div', { class: 'apilar junto', style: 'width:100%' });

    function fallo(err) {
      App.ui.vaciar(error);
      error.appendChild(el('div', { class: 'aviso error' }, [
        icono('aviso'),
        el('div', { text: err && err.message ? err.message : String(err) })
      ]));
    }

    raiz.appendChild(el('div', { class: 'tarjeta tarjeta-acceso' }, [
      el('div', { class: 'marca-acceso' }, [
        el('div', { class: 'marca-titulo', text: 'Gestión Electoral' }),
        el('div', { class: 'marca-sub', text: 'Administración de gastos' })
      ]),
      el('p', {
        class: 'silencio',
        text: 'Los datos de la convocatoria están en el servidor. Identifíquese con la cuenta de Google autorizada para acceder.'
      }),
      mensaje ? el('div', { class: 'aviso' }, [icono('aviso'), el('div', { text: mensaje })]) : null,
      !cfg.configurado
        ? el('div', { class: 'aviso error' }, [
            icono('aviso'),
            el('div', {}, [
              el('strong', { text: 'El acceso no está configurado en el servidor. ' }),
              cfg.aviso || ''
            ])
          ])
        : contenedorBoton,
      error
    ]));

    if (cfg.configurado) {
      App.api.pintarBotonAcceso(
        contenedorBoton,
        function () { App.arrancarAplicacion(); },
        fallo
      );
    }
  }

  /* ---------- Indicador de sincronización ---------- */

  var ETIQUETAS = {
    guardando: { texto: 'Guardando…', clase: 'sync-trabajando' },
    guardado: { texto: 'Guardado', clase: 'sync-ok' },
    pendiente: { texto: 'Cambios sin guardar', clase: 'sync-trabajando' },
    error: { texto: 'Sin guardar', clase: 'sync-error' },
    conflicto: { texto: 'Conflicto', clase: 'sync-error' },
    inactivo: { texto: 'Sólo en este navegador', clase: 'sync-local' }
  };

  function indicador() {
    var s = App.store.sincronizacion();
    var e = ETIQUETAS[s.situacion] || ETIQUETAS.inactivo;

    var detalle = null;
    if (s.modo === 'servidor' && s.situacion === 'guardado' && s.actualizado) {
      detalle = 'Última vez: ' + App.ui.fecha(new Date(s.actualizado)) +
        (s.actualizadoPor ? ' · ' + s.actualizadoPor : '');
    } else if (s.mensaje) {
      detalle = s.mensaje;
    } else if (s.modo !== 'servidor') {
      detalle = 'Sin servidor: los datos no se comparten con otros dispositivos.';
    }

    return el('div', { class: 'estado-sync ' + e.clase }, [
      el('div', { class: 'fila' }, [
        el('span', { class: 'punto-sync' }),
        el('strong', { text: e.texto })
      ]),
      detalle ? el('p', { class: 'silencio', text: detalle }) : null
    ]);
  }

  function fichaUsuario() {
    var sesion = App.api.estado().sesion;
    if (!sesion) { return null; }

    return el('div', { class: 'ficha-usuario' }, [
      el('div', { class: 'crece' }, [
        el('strong', { class: 'nombre-usuario', text: sesion.nombre }),
        el('span', { class: 'silencio', text: sesion.correo })
      ]),
      el('button', {
        class: 'btn fantasma pequeno',
        title: 'Cerrar sesión',
        onClick: function () {
          App.ui.confirmar({
            titulo: 'Cerrar sesión',
            parrafos: ['Se cerrará la sesión en este dispositivo. Los datos guardados no se pierden.'],
            textoConfirmar: 'Cerrar sesión',
            alConfirmar: function () {
              App.api.cerrarSesion();
              pantallaAcceso('Sesión cerrada.');
            }
          });
        }
      }, 'Salir')
    ]);
  }

  /* ---------- Conflicto entre dispositivos ---------- */

  function resolverConflicto(registro) {
    App.ui.confirmar({
      titulo: 'Otro dispositivo guardó cambios',
      parrafos: [
        'Mientras trabajaba aquí, ' + (registro && registro.actualizadoPor ? registro.actualizadoPor : 'otra sesión') +
          ' guardó una versión distinta de la convocatoria' +
          (registro && registro.actualizado ? ' el ' + App.ui.fecha(new Date(registro.actualizado)) : '') + '.',
        'No se ha sobrescrito nada. Elija con cuál se queda: sus cambios de este dispositivo, o los que hay en el servidor.'
      ],
      aviso: 'Lo que descarte no se puede recuperar. Si tiene dudas, exporte antes una copia desde «Carga de Datos».',
      textoCancelar: 'Quedarme con lo del servidor',
      textoConfirmar: 'Imponer mis cambios',
      peligro: true,
      alConfirmar: function () {
        App.store.imponerLocal(registro ? registro.version : 0);
        App.ui.flotante('Sus cambios se han guardado sobre los del servidor');
      }
    });

    /* «Cancelar» equivale a adoptar lo del servidor, así que se engancha al
       cierre del diálogo por esa vía. */
    var velo = document.querySelector('.velo-modal');
    if (!velo) { return; }
    var cancelar = velo.querySelector('.pie-modal .btn.secundario');
    if (cancelar) {
      cancelar.addEventListener('click', function () {
        if (registro) {
          App.store.adoptarDelServidor(registro);
          App.ui.flotante('Se ha cargado la versión del servidor');
        }
      });
    }
  }

  /* Consulta es el único papel que restringe qué ve la interfaz (los demás
     sólo cambian qué botones de gestión de usuarios aparecen). Sin sesión
     (modo local, o servidor en el instante antes de identificarse) no hay
     restricción: no tiene sentido limitar un cuaderno de trabajo personal. */
  function esConsulta() {
    var sesion = App.api.estado().sesion;
    return Boolean(sesion && sesion.rol === 'consulta');
  }

  App.sesion = {
    pantallaAcceso: pantallaAcceso,
    indicador: indicador,
    fichaUsuario: fichaUsuario,
    esConsulta: esConsulta
  };

  App.pedirSesion = function (mensaje) { pantallaAcceso(mensaje || 'La sesión ha caducado.'); };
  App.resolverConflicto = resolverConflicto;
})(window.App = window.App || {});
