/* Módulo "Importe por asistencia": pantallas vacías por ahora. Sólo existen
   para que el módulo se pueda abrir y separar del de administración de gastos
   mientras se define qué calcula. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  function enConstruccion(texto) {
    return el('section', { class: 'tarjeta' }, [
      el('div', { class: 'aviso' }, [icono('aviso'), el('div', { text: texto })])
    ]);
  }

  App.vistas = App.vistas || {};

  App.vistas['asistencia-dashboard'] = {
    titulo: 'Dashboard de Asistencia',
    subtitulo: 'Resultados del cálculo de importe por asistencia.',
    render: function () {
      return enConstruccion('Este apartado está pendiente de definir: aquí irán los resultados.');
    }
  };

  App.vistas['asistencia-config'] = {
    titulo: 'Configuración de Asistencia',
    subtitulo: 'Parámetros del cálculo de importe por asistencia.',
    render: function () {
      return enConstruccion('Este apartado está pendiente de definir: aquí irán los parámetros.');
    }
  };
})(window.App = window.App || {});
