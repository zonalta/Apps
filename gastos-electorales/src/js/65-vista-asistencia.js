/* Módulo "Importe por asistencia". Por ahora sólo tiene la configuración de
   los ámbitos de actuación; el dashboard sigue pendiente de definir. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  /* Campo numérico de una celda de la tabla, con su unidad al final. */
  function celdaNumero(ambito, clave, sufijo, paso) {
    var input = el('input', {
      type: 'number', min: '0', step: paso || '0.01',
      value: ambito[clave],
      'aria-label': clave + ' — ' + ambito.nombre,
      onInput: function (e) {
        var v = parseFloat(e.target.value);
        App.store.muta(function () { ambito[clave] = isNaN(v) ? 0 : v; });
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
    return { id: 'a' + (Math.max.apply(null, ids.concat([0])) + 1), nombre: '', horasMax: 0, importeHora: 0, unidades: 0 };
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

  function fila(ambito) {
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
      celdaNumero(ambito, 'horasMax', 'h.'),
      celdaNumero(ambito, 'importeHora', '€'),
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
                el('th', { text: 'Unidades funcionales' }),
                el('th', {})
              ])]),
              el('tbody', {}, ambitos.map(fila))
            ])
          ])
        : el('p', { class: 'sin-datos', text: 'No hay ámbitos. Añada el primero.' })
    ]);
  }

  App.vistas = App.vistas || {};

  App.vistas['asistencia-dashboard'] = {
    titulo: 'Dashboard de Asistencia',
    subtitulo: 'Resultados del cálculo de importe por asistencia.',
    render: function () {
      return el('section', { class: 'tarjeta' }, [
        el('div', { class: 'aviso' }, [icono('aviso'), el('div', { text: 'Este apartado está pendiente de definir: aquí irán los resultados.' })])
      ]);
    }
  };

  App.vistas['asistencia-config'] = {
    titulo: 'Configuración de Asistencia',
    subtitulo: 'Valores e importes de cada ámbito. Los cambios se guardan al instante.',
    render: function () { return tarjetaAmbitos(); }
  };
})(window.App = window.App || {});
