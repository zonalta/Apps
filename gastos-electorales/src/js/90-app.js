/* Armazón de la aplicación: navegación, pintado y arranque. */
(function (App) {
  'use strict';

  var el = App.ui.el;
  var icono = App.ui.icono;

  var VISTAS = [
    { id: 'dashboard', nombre: 'Dashboard de Informes', icono: 'dashboard' },
    { id: 'configuracion', nombre: 'Configuración de Importes', icono: 'ajustes' },
    { id: 'datos', nombre: 'Carga de Datos', icono: 'carga' }
  ];

  var actual = 'dashboard';
  var menuAbierto = false;

  function barraSuperior() {
    return el('header', { class: 'topbar no-imprimir' }, [
      el('button', {
        class: 'btn fantasma pequeno',
        'aria-label': 'Abrir menú de navegación',
        'aria-expanded': String(menuAbierto),
        onClick: function () { menuAbierto = !menuAbierto; App.render(); }
      }, [icono('menu', 20)]),
      el('strong', { text: 'Elecciones Canarias' })
    ]);
  }

  function barraLateral() {
    return el('nav', { class: 'sidebar no-imprimir', 'aria-label': 'Navegación principal' }, [
      el('div', {}, [
        el('div', { class: 'marca-titulo', text: 'Gestión Electoral' }),
        el('div', { class: 'marca-sub', text: 'Administración de gastos' })
      ]),
      el('div', { class: 'nav' }, VISTAS.map(function (v) {
        return el('button', {
          'aria-current': actual === v.id ? 'page' : null,
          onClick: function () { App.irA(v.id); }
        }, [icono(v.icono), v.nombre]);
      })),
      el('div', { style: 'margin-top:auto' }, [
        el('p', { class: 'silencio', text: 'Datos guardados en este navegador' })
      ])
    ]);
  }

  function pie() {
    return el('footer', { class: 'pie no-imprimir' }, [
      el('span', { text: 'Sistema de gestión de colaboradores electorales — Canarias' }),
      el('span', { text: App.geo.MUNICIPIOS.length + ' municipios · 7 islas · 2 provincias' })
    ]);
  }

  /* render({ foco }) reconstruye la vista actual. `foco` reinstala el cursor en
     un campo tras el repintado, para que escribir en un buscador no lo pierda. */
  App.render = function (opciones) {
    opciones = opciones || {};
    var vista = App.vistas[actual];
    var raiz = document.getElementById('app');

    var seleccion = null;
    if (opciones.foco) {
      var previo = document.getElementById(opciones.foco);
      if (previo) { seleccion = previo.selectionStart; }
    }

    App.ui.vaciar(raiz);
    raiz.className = 'app' + (menuAbierto ? ' menu-abierto' : '');

    var contenido = el('div', { class: 'contenido' }, [
      vista.titulo && actual !== 'dashboard'
        ? el('div', { class: 'cabecera-pagina no-imprimir' }, [
            el('h1', { text: vista.titulo }),
            vista.subtitulo ? el('p', { text: vista.subtitulo }) : null
          ])
        : null,
      vista.render()
    ]);

    raiz.appendChild(barraLateral());
    if (menuAbierto) {
      raiz.appendChild(el('div', {
        class: 'velo no-imprimir',
        onClick: function () { menuAbierto = false; App.render(); }
      }));
    }
    if (vista.panelLateral) { raiz.appendChild(vista.panelLateral()); }
    raiz.appendChild(el('div', { class: 'principal' }, [contenido, pie()]));

    /* La barra superior sólo existe en pantallas estrechas; se inserta al
       principio para que quede pegada arriba. */
    raiz.insertBefore(barraSuperior(), raiz.firstChild);

    if (opciones.foco) {
      var campo = document.getElementById(opciones.foco);
      if (campo) {
        campo.focus();
        if (seleccion != null && campo.setSelectionRange) {
          try { campo.setSelectionRange(seleccion, seleccion); } catch (e) { /* tipos sin selección */ }
        }
      }
    }
  };

  App.irA = function (id) {
    actual = id;
    menuAbierto = false;
    App.render();
    window.scrollTo(0, 0);
  };

  App.iniciar = function () {
    App.store.init();
    App.render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.iniciar);
  } else {
    App.iniciar();
  }
})(window.App = window.App || {});
