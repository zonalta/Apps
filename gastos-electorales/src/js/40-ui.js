/* Utilidades compartidas de interfaz: formato, construcción de nodos, gráficas
   de barras y avisos. Las gráficas se construyen con HTML en lugar de SVG para
   que se adapten solas al ancho disponible, que en este proyecto va desde el
   iPad hasta un monitor de escritorio. */
(function (App) {
  'use strict';

  var fmtEuro = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  var fmtEuroCorto = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  });
  var fmtNum = new Intl.NumberFormat('es-ES');
  var fmtFecha = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  function euro(n) { return fmtEuro.format(Number(n) || 0); }
  function euroCorto(n) { return fmtEuroCorto.format(Number(n) || 0); }
  function numero(n) { return fmtNum.format(Number(n) || 0); }
  function fecha(d) { return fmtFecha.format(d); }
  function porcentaje(parte, total) {
    if (!total) { return '0 %'; }
    return (Math.round((parte / total) * 1000) / 10).toString().replace('.', ',') + ' %';
  }

  /* el(tag, props, hijos) — constructor de nodos sin innerHTML, para que ningún
     nombre de municipio que venga de un fichero pueda inyectar marcado. */
  function el(tag, props, hijos) {
    var nodo = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) { return; }
        if (k === 'class') { nodo.className = v; }
        else if (k === 'text') { nodo.textContent = v; }
        else if (k === 'html') { nodo.innerHTML = v; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          nodo.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'dataset') {
          Object.keys(v).forEach(function (d) { nodo.dataset[d] = v[d]; });
        } else if (v === true) { nodo.setAttribute(k, ''); }
        else { nodo.setAttribute(k, v); }
      });
    }
    (Array.isArray(hijos) ? hijos : (hijos != null ? [hijos] : []))
      .forEach(function (h) {
        if (h == null || h === false) { return; }
        nodo.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
      });
    return nodo;
  }

  function vaciar(nodo) {
    while (nodo.firstChild) { nodo.removeChild(nodo.firstChild); }
    return nodo;
  }

  /* Iconos en línea, para no depender de ninguna fuente externa. */
  var TRAZOS = {
    dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
    ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
    carga: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    grupo: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
    euro: 'M4 10h12 M4 14h9 M18 6.4A7 7 0 108 17.6',
    edificio: 'M3 21h18 M5 21V7l7-4 7 4v14 M9 9h.01 M9 13h.01 M9 17h.01 M15 9h.01 M15 13h.01 M15 17h.01',
    documento: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8',
    menu: 'M3 12h18 M3 6h18 M3 18h18',
    aviso: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
    check: 'M20 6L9 17l-5-5',
    descarga: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    imprimir: 'M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z',
    identidad: 'M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z M9 12a2 2 0 100-4 2 2 0 000 4z M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2 M15 10h4 M15 14h4',
    escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    mesa: 'M3 10h18 M5 10V6a2 2 0 012-2h10a2 2 0 012 2v4 M6 10v10 M18 10v10 M9 14h6',
    tableta: 'M5 2h14a1 1 0 011 1v18a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z M12 18h.01',
    refrescar: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15'
  };

  function icono(nombre, tam) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', tam || 20);
    svg.setAttribute('height', tam || 20);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('ico');
    (TRAZOS[nombre] || '').split(' M').forEach(function (d, i) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', i === 0 ? d : 'M' + d);
      svg.appendChild(path);
    });
    return svg;
  }

  /* Gráfica de barras horizontales para comparar magnitudes.
     Una sola tinta: la categoría ya está en el eje, así que el color no tiene
     que codificar identidad. Cada barra lleva su valor escrito al lado, de modo
     que la lectura nunca depende sólo del color ni de la longitud. */
  function barras(items, opciones) {
    opciones = opciones || {};
    var contenedor = el('div', { class: 'gr-barras' });
    var visibles = items.filter(function (i) { return Number(i.valor) > 0; });

    if (!visibles.length) {
      contenedor.appendChild(el('p', {
        class: 'gr-vacia',
        text: opciones.vacio || 'Sin importes que representar con la selección actual.'
      }));
      return contenedor;
    }

    var max = Math.max.apply(null, visibles.map(function (i) { return Number(i.valor); }));
    var total = visibles.reduce(function (a, i) { return a + Number(i.valor); }, 0);
    var formato = opciones.formato || euroCorto;

    /* En columnas estrechas la etiqueta y el valor comparten una línea y la
       barra ocupa el ancho completo debajo: así ningún nombre se recorta. */
    if (opciones.compacta) { contenedor.classList.add('compacta'); }

    visibles
      .slice()
      .sort(function (a, b) { return b.valor - a.valor; })
      .slice(0, opciones.limite || 100)
      .forEach(function (item) {
        var pct = max ? (item.valor / max) * 100 : 0;
        var descripcion = item.etiqueta + ': ' + euro(item.valor) +
          ' (' + porcentaje(item.valor, total) + ' de lo representado)';
        var barra = el('div', { class: 'gr-pista' }, [
          el('div', { class: 'gr-barra', style: 'width:' + Math.max(pct, 0.8) + '%' })
        ]);

        if (opciones.compacta) {
          contenedor.appendChild(el('div', { class: 'gr-fila', title: descripcion }, [
            el('div', { class: 'gr-cabeza' }, [
              el('span', { class: 'gr-etiqueta', text: item.etiqueta }),
              el('span', { class: 'gr-valor num', text: formato(item.valor) })
            ]),
            barra
          ]));
          return;
        }

        contenedor.appendChild(el('div', { class: 'gr-fila', title: descripcion }, [
          el('span', { class: 'gr-etiqueta', text: item.etiqueta }),
          barra,
          el('span', { class: 'gr-valor num', text: formato(item.valor) })
        ]));
      });

    return contenedor;
  }

  var temporizadorAviso = null;
  function flotante(mensaje, esError) {
    var previo = document.querySelector('.aviso-flotante');
    if (previo) { previo.remove(); }
    if (temporizadorAviso) { clearTimeout(temporizadorAviso); }

    var nodo = el('div', {
      class: 'aviso-flotante' + (esError ? ' error' : ''),
      role: 'status',
      'aria-live': 'polite',
      text: mensaje
    });
    document.body.appendChild(nodo);
    temporizadorAviso = setTimeout(function () { nodo.remove(); }, esError ? 7000 : 3500);
  }

  /* Descarga en cliente, sin pasar por el servidor. */
  function descargar(nombre, contenido, tipo) {
    var blob = new Blob(['﻿' + contenido], { type: (tipo || 'text/csv') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: nombre });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function aCSV(filas) {
    return filas.map(function (fila) {
      return fila.map(function (celda) {
        var t = celda == null ? '' : String(celda);
        return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
      }).join(';');
    }).join('\r\n');
  }

  App.ui = {
    el: el,
    vaciar: vaciar,
    icono: icono,
    euro: euro,
    euroCorto: euroCorto,
    numero: numero,
    fecha: fecha,
    porcentaje: porcentaje,
    barras: barras,
    flotante: flotante,
    descargar: descargar,
    aCSV: aCSV
  };
})(window.App = window.App || {});
