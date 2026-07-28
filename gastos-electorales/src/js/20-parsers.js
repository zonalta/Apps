/* Lectura de los ficheros de datos que aporta el usuario.
   Soporta CSV/TSV y XLSX. El XLSX se abre con las APIs del propio navegador
   (DecompressionStream + DOMParser): un .xlsx es un ZIP con XML dentro, así que
   no hace falta ninguna librería externa. */
(function (App) {
  'use strict';

  /* ---------- CSV ---------- */

  function detectarDelimitador(linea) {
    var candidatos = [';', ',', '\t', '|'];
    var mejor = ';';
    var max = -1;
    candidatos.forEach(function (d) {
      var n = 0;
      var dentro = false;
      for (var i = 0; i < linea.length; i++) {
        var ch = linea[i];
        if (ch === '"') { dentro = !dentro; }
        else if (ch === d && !dentro) { n++; }
      }
      if (n > max) { max = n; mejor = d; }
    });
    return max > 0 ? mejor : ';';
  }

  function parseCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    var primeraLinea = texto.split(/\r?\n/)[0] || '';
    var delim = detectarDelimitador(primeraLinea);

    var filas = [];
    var fila = [];
    var campo = '';
    var entreComillas = false;

    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (entreComillas) {
        if (ch === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else { entreComillas = false; }
        } else { campo += ch; }
        continue;
      }
      if (ch === '"') { entreComillas = true; }
      else if (ch === delim) { fila.push(campo); campo = ''; }
      else if (ch === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
      else if (ch === '\r') { /* se ignora, el \n cierra la fila */ }
      else { campo += ch; }
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

    return filas.filter(function (f) {
      return f.some(function (c) { return String(c).trim() !== ''; });
    });
  }

  /* ---------- XLSX ---------- */

  function leerU16(dv, off) { return dv.getUint16(off, true); }
  function leerU32(dv, off) { return dv.getUint32(off, true); }

  /* Recorre el directorio central del ZIP y devuelve { nombre: {offset, metodo, tamComprimido} } */
  function indexarZip(buffer) {
    var dv = new DataView(buffer);
    var bytes = new Uint8Array(buffer);

    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
      if (leerU32(dv, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) { throw new Error('El fichero no es un XLSX válido (no se encontró el índice del ZIP).'); }

    var nEntradas = leerU16(dv, eocd + 10);
    var offCentral = leerU32(dv, eocd + 16);

    var entradas = {};
    var p = offCentral;
    for (var n = 0; n < nEntradas; n++) {
      if (leerU32(dv, p) !== 0x02014b50) { break; }
      var metodo = leerU16(dv, p + 10);
      var tamComprimido = leerU32(dv, p + 20);
      var lenNombre = leerU16(dv, p + 28);
      var lenExtra = leerU16(dv, p + 30);
      var lenComentario = leerU16(dv, p + 32);
      var offLocal = leerU32(dv, p + 42);
      var nombre = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + lenNombre));
      entradas[nombre] = { offLocal: offLocal, metodo: metodo, tamComprimido: tamComprimido };
      p += 46 + lenNombre + lenExtra + lenComentario;
    }
    return { dv: dv, bytes: bytes, entradas: entradas };
  }

  function extraer(zip, nombre) {
    var e = zip.entradas[nombre];
    if (!e) { return Promise.resolve(null); }

    var lenNombre = leerU16(zip.dv, e.offLocal + 26);
    var lenExtra = leerU16(zip.dv, e.offLocal + 28);
    var inicio = e.offLocal + 30 + lenNombre + lenExtra;
    var datos = zip.bytes.subarray(inicio, inicio + e.tamComprimido);

    if (e.metodo === 0) {
      return Promise.resolve(new TextDecoder('utf-8').decode(datos));
    }
    if (e.metodo !== 8) {
      return Promise.reject(new Error('Compresión ZIP no soportada en ' + nombre));
    }
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Este navegador no puede descomprimir XLSX. Guarde el fichero como CSV.'));
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([datos]).stream().pipeThrough(ds);
    return new Response(stream).text();
  }

  function letrasAIndice(ref) {
    var letras = /^([A-Z]+)/.exec(ref || '');
    if (!letras) { return 0; }
    var n = 0;
    var s = letras[1];
    for (var i = 0; i < s.length; i++) {
      n = n * 26 + (s.charCodeAt(i) - 64);
    }
    return n - 1;
  }

  function textoDeNodo(nodo) {
    /* Un <si> puede venir partido en varios <t> por formato enriquecido. */
    var ts = nodo.getElementsByTagName('t');
    var out = '';
    for (var i = 0; i < ts.length; i++) { out += ts[i].textContent; }
    return out;
  }

  function parseXLSX(buffer) {
    var zip = indexarZip(buffer);

    /* Localiza la primera hoja siguiendo workbook.xml -> rels; si algo falta,
       cae en el nombre convencional sheet1.xml. */
    return extraer(zip, 'xl/workbook.xml').then(function (wbXml) {
      var rutaHoja = 'xl/worksheets/sheet1.xml';
      if (wbXml) {
        try {
          var wb = new DOMParser().parseFromString(wbXml, 'application/xml');
          var hojas = wb.getElementsByTagName('sheet');
          if (hojas.length) {
            var rid = hojas[0].getAttribute('r:id') || hojas[0].getAttributeNS(
              'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            if (rid) {
              return extraer(zip, 'xl/_rels/workbook.xml.rels').then(function (relsXml) {
                if (relsXml) {
                  var rels = new DOMParser().parseFromString(relsXml, 'application/xml');
                  var lista = rels.getElementsByTagName('Relationship');
                  for (var i = 0; i < lista.length; i++) {
                    if (lista[i].getAttribute('Id') === rid) {
                      var destino = lista[i].getAttribute('Target').replace(/^\/?xl\//, '').replace(/^\//, '');
                      return 'xl/' + destino;
                    }
                  }
                }
                return rutaHoja;
              });
            }
          }
        } catch (e) { /* se usa la ruta convencional */ }
      }
      return rutaHoja;
    }).then(function (rutaHoja) {
      return Promise.all([
        extraer(zip, 'xl/sharedStrings.xml'),
        extraer(zip, rutaHoja)
      ]);
    }).then(function (res) {
      var ssXml = res[0];
      var hojaXml = res[1];
      if (!hojaXml) { throw new Error('No se encontró ninguna hoja de cálculo en el fichero.'); }

      var compartidas = [];
      if (ssXml) {
        var ssDoc = new DOMParser().parseFromString(ssXml, 'application/xml');
        var sis = ssDoc.getElementsByTagName('si');
        for (var i = 0; i < sis.length; i++) { compartidas.push(textoDeNodo(sis[i])); }
      }

      var doc = new DOMParser().parseFromString(hojaXml, 'application/xml');
      var filasXml = doc.getElementsByTagName('row');
      var filas = [];

      for (var r = 0; r < filasXml.length; r++) {
        var celdas = filasXml[r].getElementsByTagName('c');
        var fila = [];
        for (var c = 0; c < celdas.length; c++) {
          var celda = celdas[c];
          var idx = letrasAIndice(celda.getAttribute('r'));
          var tipo = celda.getAttribute('t');
          var valor = '';

          if (tipo === 's') {
            var vNodo = celda.getElementsByTagName('v')[0];
            var pos = vNodo ? parseInt(vNodo.textContent, 10) : -1;
            valor = compartidas[pos] !== undefined ? compartidas[pos] : '';
          } else if (tipo === 'inlineStr') {
            valor = textoDeNodo(celda);
          } else {
            var v = celda.getElementsByTagName('v')[0];
            valor = v ? v.textContent : '';
          }

          while (fila.length < idx) { fila.push(''); }
          fila[idx] = valor;
        }
        if (fila.some(function (x) { return String(x).trim() !== ''; })) { filas.push(fila); }
      }
      return filas;
    });
  }

  /* ---------- Punto de entrada común ---------- */

  function leerFichero(file) {
    var esExcel = /\.xlsx$/i.test(file.name);
    if (/\.xls$/i.test(file.name)) {
      return Promise.reject(new Error(
        'El formato .xls antiguo no está soportado. Guarde el fichero como .xlsx o CSV.'));
    }
    if (esExcel) {
      return file.arrayBuffer().then(parseXLSX);
    }
    return file.text().then(parseCSV);
  }

  /* ---------- Interpretación de las tablas ---------- */

  function aNumero(valor) {
    if (valor == null || valor === '') { return 0; }
    var t = String(valor).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  /* Busca la fila de cabecera: la primera cuyas celdas casen con alguno de los
     patrones dados. Devuelve { indice, columnas } o null. */
  function localizarCabecera(filas, patrones) {
    for (var f = 0; f < Math.min(filas.length, 20); f++) {
      var columnas = {};
      filas[f].forEach(function (celda, c) {
        var txt = App.geo.normaliza(celda);
        Object.keys(patrones).forEach(function (clave) {
          if (columnas[clave] !== undefined) { return; }
          if (patrones[clave].test(txt)) { columnas[clave] = c; }
        });
      });
      if (columnas.municipio !== undefined) { return { indice: f, columnas: columnas }; }
    }
    return null;
  }

  function resumen(okCount, noReconocidos, discrepancias) {
    return {
      filasImportadas: okCount,
      noReconocidos: noReconocidos,
      discrepancias: discrepancias || []
    };
  }

  /* Representantes: MUNICIPIO | PD0 | PD1 | ... | PD5 [| TOTAL] */
  function interpretarRepresentantes(filas) {
    var patrones = { municipio: /^(municipios?|codigo|cod|nombre)$/ };
    App.store.TIPOLOGIAS_PD.forEach(function (t) {
      patrones[t] = new RegExp('^' + t.toLowerCase() + '$');
    });

    var cab = localizarCabecera(filas, patrones);
    /* Sin cabecera reconocible se asume el orden del briefing: municipio + 6 PD. */
    var colMunicipio = cab ? cab.columnas.municipio : 0;
    var inicio = cab ? cab.indice + 1 : 0;
    var colsPD = {};
    App.store.TIPOLOGIAS_PD.forEach(function (t, i) {
      colsPD[t] = (cab && cab.columnas[t] !== undefined) ? cab.columnas[t] : (colMunicipio + 1 + i);
    });

    var datos = {};
    var noReconocidos = [];
    var discrepancias = [];
    var n = 0;

    for (var f = inicio; f < filas.length; f++) {
      var fila = filas[f];
      var bruto = fila[colMunicipio];
      if (!String(bruto || '').trim()) { continue; }
      var codigo = App.geo.resolverMunicipio(bruto);
      if (!codigo) { noReconocidos.push(String(bruto).trim()); continue; }
      var choque = App.geo.discrepancia(bruto, codigo);
      if (choque) { discrepancias.push(choque); }

      var reg = {};
      App.store.TIPOLOGIAS_PD.forEach(function (t) {
        reg[t] = aNumero(fila[colsPD[t]]);
      });
      datos[codigo] = reg;
      n++;
    }
    return { datos: datos, resumen: resumen(n, noReconocidos, discrepancias) };
  }

  /* Tablas de una sola magnitud por municipio (mesas, efectivos de policía). */
  function interpretarValorPorMunicipio(filas, patronValor) {
    var cab = localizarCabecera(filas, {
      municipio: /^(municipios?|codigo|cod|nombre)$/,
      valor: patronValor
    });

    var colMunicipio = cab ? cab.columnas.municipio : 0;
    var colValor = (cab && cab.columnas.valor !== undefined)
      ? cab.columnas.valor
      : colMunicipio + 1;
    var inicio = cab ? cab.indice + 1 : 0;

    var datos = {};
    var noReconocidos = [];
    var discrepancias = [];
    var n = 0;

    for (var f = inicio; f < filas.length; f++) {
      var fila = filas[f];
      var bruto = fila[colMunicipio];
      if (!String(bruto || '').trim()) { continue; }
      var codigo = App.geo.resolverMunicipio(bruto);
      if (!codigo) { noReconocidos.push(String(bruto).trim()); continue; }
      var choque = App.geo.discrepancia(bruto, codigo);
      if (choque) { discrepancias.push(choque); }
      datos[codigo] = aNumero(fila[colValor]);
      n++;
    }
    return { datos: datos, resumen: resumen(n, noReconocidos, discrepancias) };
  }

  App.parsers = {
    parseCSV: parseCSV,
    parseXLSX: parseXLSX,
    leerFichero: leerFichero,
    aNumero: aNumero,
    interpretarRepresentantes: interpretarRepresentantes,
    interpretarMesas: function (filas) {
      return interpretarValorPorMunicipio(filas, /(mesas|n mesas|numero de mesas|total mesas)/);
    },
    interpretarPolicia: function (filas) {
      return interpretarValorPorMunicipio(filas, /(efectivos|policia|agentes|dotacion)/);
    }
  };
})(window.App = window.App || {});
