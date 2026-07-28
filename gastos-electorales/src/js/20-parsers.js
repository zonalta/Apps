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

  /* Un fichero de datos puede traer varios censos a la vez. Cada bloque se
     reconoce por su cabecera, de modo que un único Excel con
     MUNICIPIOS | PD0..PD5 | MESAS alimenta representantes y mesas en una sola
     carga, y un fichero de dos columnas sigue funcionando igual. */
  var BLOQUES = [
    {
      id: 'representantes',
      nombre: 'Representantes de la Administración',
      columnas: App.store.TIPOLOGIAS_PD.map(function (t) {
        return { clave: t, patron: new RegExp('^' + t.toLowerCase().replace('pd', 'pd\\s*') + '$') };
      }),
      /* Varias columnas: el valor de cada municipio es un objeto PD0..PD5. */
      leer: function (fila, cols) {
        var reg = {};
        App.store.TIPOLOGIAS_PD.forEach(function (t) {
          reg[t] = aNumero(fila[cols[t]]);
        });
        return reg;
      },
      sumar: function (acc, v) {
        App.store.TIPOLOGIAS_PD.forEach(function (t) { acc[t] = (acc[t] || 0) + v[t]; });
        return acc;
      },
      vacio: function () { return {}; }
    },
    {
      id: 'mesas',
      nombre: 'Mesas electorales',
      columnas: [{ clave: 'mesas', patron: /^(mesas|n mesas|no mesas|num mesas|numero de mesas|total mesas|mesas electorales)$/ }],
      leer: function (fila, cols) { return aNumero(fila[cols.mesas]); },
      sumar: function (acc, v) { return acc + v; },
      vacio: function () { return 0; }
    },
    {
      id: 'policia',
      nombre: 'Efectivos de policía',
      columnas: [{ clave: 'policia', patron: /^(efectivos|policia|agentes|dotacion|efectivos policia|efectivos de policia)$/ }],
      leer: function (fila, cols) { return aNumero(fila[cols.policia]); },
      sumar: function (acc, v) { return acc + v; },
      vacio: function () { return 0; }
    }
  ];

  var PATRON_MUNICIPIO = /^(municipios?|codigo|cod|nombre|termino municipal|ayuntamientos?)$/;
  var PATRON_TOTALES = /^(total|totales|suma|sumas|total general)/;

  /* Localiza la fila de cabecera y el índice de cada columna conocida. Se miran
     las 20 primeras filas porque estos ficheros suelen llevar título encima. */
  function localizarCabecera(filas) {
    for (var f = 0; f < Math.min(filas.length, 20); f++) {
      var cols = {};
      var municipio = -1;

      filas[f].forEach(function (celda, c) {
        var txt = App.geo.normaliza(celda);
        if (!txt) { return; }
        if (municipio < 0 && PATRON_MUNICIPIO.test(txt)) { municipio = c; return; }
        BLOQUES.forEach(function (b) {
          b.columnas.forEach(function (col) {
            if (cols[col.clave] === undefined && col.patron.test(txt)) { cols[col.clave] = c; }
          });
        });
      });

      if (municipio >= 0) { return { indice: f, municipio: municipio, columnas: cols }; }
    }
    return null;
  }

  /* Un bloque está presente cuando aparecen todas sus columnas. Media tabla de
     representantes (sólo PD0 y PD3, por ejemplo) es más probable que sea un
     error del fichero que una carga parcial deliberada, así que no se importa. */
  function bloquesPresentes(columnas) {
    return BLOQUES.filter(function (b) {
      return b.columnas.every(function (col) { return columnas[col.clave] !== undefined; });
    });
  }

  function interpretarFicheroDatos(filas) {
    var cab = localizarCabecera(filas);
    if (!cab) {
      throw new Error('No se encontró la columna de municipios. La cabecera debe incluir ' +
        'MUNICIPIOS (o CÓDIGO / NOMBRE) y al menos una de: PD0…PD5, MESAS o EFECTIVOS.');
    }

    var presentes = bloquesPresentes(cab.columnas);
    if (!presentes.length) {
      throw new Error('Se reconoció la columna de municipios pero ningún dato. ' +
        'Se esperaba PD0…PD5 (representantes), MESAS o EFECTIVOS.');
    }

    var resultado = {};
    var sumas = {};
    presentes.forEach(function (b) {
      resultado[b.id] = {};
      sumas[b.id] = b.vacio();
    });

    var noReconocidos = [];
    var discrepancias = [];
    var filaTotales = null;

    for (var f = cab.indice + 1; f < filas.length; f++) {
      var fila = filas[f];
      var bruto = fila[cab.municipio];
      var texto = String(bruto == null ? '' : bruto).trim();
      if (!texto) { continue; }

      var codigo = App.geo.resolverMunicipio(texto);

      /* La fila de totales del fichero no es un municipio: se guarda aparte y
         luego sirve para comprobar que lo importado cuadra con lo declarado. */
      if (!codigo && PATRON_TOTALES.test(App.geo.normaliza(texto))) {
        filaTotales = fila;
        continue;
      }
      if (!codigo) { noReconocidos.push(texto); continue; }

      var choque = App.geo.discrepancia(texto, codigo);
      if (choque) { discrepancias.push(choque); }

      presentes.forEach(function (b) {
        var valor = b.leer(fila, cab.columnas);
        resultado[b.id][codigo] = valor;
        sumas[b.id] = b.sumar(sumas[b.id], valor);
      });
    }

    /* Comprobación contra la fila de totales, cuando el fichero la trae. */
    var comprobacion = null;
    if (filaTotales) {
      comprobacion = { cuadra: true, lineas: [] };
      presentes.forEach(function (b) {
        b.columnas.forEach(function (col) {
          var declarado = aNumero(filaTotales[cab.columnas[col.clave]]);
          var calculado = b.id === 'representantes'
            ? (sumas[b.id][col.clave] || 0)
            : sumas[b.id];
          var cuadra = Math.abs(declarado - calculado) < 0.005;
          if (!cuadra) { comprobacion.cuadra = false; }
          comprobacion.lineas.push({
            columna: col.clave.toUpperCase(),
            declarado: declarado,
            calculado: calculado,
            cuadra: cuadra
          });
        });
      });
    }

    /* En los ficheros reales hay un representante por mesa, así que ΣPD0..PD5
       debería igualar a MESAS. No se impone como regla —puede no cumplirse en
       otra convocatoria— pero cuando ambos censos vienen en el mismo fichero se
       contrastan, porque una diferencia suele delatar una fila mal cuadrada. */
    var repVsMesas = null;
    if (resultado.representantes && resultado.mesas) {
      repVsMesas = { coinciden: 0, desajustes: [] };
      Object.keys(resultado.representantes).forEach(function (codigo) {
        if (resultado.mesas[codigo] === undefined) { return; }
        var suma = App.store.TIPOLOGIAS_PD.reduce(function (a, t) {
          return a + (resultado.representantes[codigo][t] || 0);
        }, 0);
        var mesas = resultado.mesas[codigo];
        if (suma === mesas) {
          repVsMesas.coinciden += 1;
        } else {
          var geo = App.geo.municipio(codigo);
          repVsMesas.desajustes.push({
            codigo: codigo,
            nombre: geo ? geo.nombre : codigo,
            representantes: suma,
            mesas: mesas
          });
        }
      });
    }

    return {
      bloques: presentes.map(function (b) {
        return {
          id: b.id,
          nombre: b.nombre,
          datos: resultado[b.id],
          municipios: Object.keys(resultado[b.id]).length
        };
      }),
      noReconocidos: noReconocidos,
      discrepancias: discrepancias,
      comprobacion: comprobacion,
      repVsMesas: repVsMesas
    };
  }

  App.parsers = {
    parseCSV: parseCSV,
    parseXLSX: parseXLSX,
    leerFichero: leerFichero,
    aNumero: aNumero,
    BLOQUES: BLOQUES,
    interpretarFicheroDatos: interpretarFicheroDatos
  };
})(window.App = window.App || {});
