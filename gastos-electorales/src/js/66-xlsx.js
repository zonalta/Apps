/* Escritor mínimo de ficheros .xlsx, sin dependencias. Genera un libro con
   varias hojas, estilos básicos (cabecera, importes en euros, enteros,
   porcentajes, filas de grupo), anchos de columna, fila de cabecera fija y
   autofiltro. El zip va sin comprimir ("stored"): son pocos KB y así no hace
   falta ningún compresor. */
(function (App) {
  'use strict';

  /* Índices de estilo (posición en cellXfs de styles.xml, más abajo). */
  var ESTILO = {
    normal: 0, cab: 1, euro: 2, ent: 3, pct: 4, neg: 5, euroNeg: 6, entNeg: 7,
    titulo: 8, grupo: 9, grupoEuro: 10, grupoEnt: 11, nota: 12, ajuste: 13,
    pctNeg: 14, rojo: 15, grupoPct: 16
  };

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00&quot; €&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>' +
    '<fonts count="6">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="14"/><color rgb="FF00346F"/><name val="Calibri"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF737783"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFBA1A1A"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF00346F"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDF5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="17">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="3" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="165" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  function esc(t) {
    return String(t)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function letra(n) {
    var s = '';
    n += 1;
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /* Una celda es un valor suelto o { v, s } con su estilo. null/'' sin estilo
     no se escribe; con estilo se escribe vacía (para pintar el fondo). */
  function xmlCelda(ref, celda) {
    var v = celda, s = 0;
    if (celda && typeof celda === 'object') { v = celda.v; s = celda.s || 0; }
    var estilo = s ? ' s="' + s + '"' : '';
    if (v === null || v === undefined || v === '') {
      return s ? '<c r="' + ref + '"' + estilo + '/>' : '';
    }
    if (typeof v === 'number' && isFinite(v)) {
      return '<c r="' + ref + '"' + estilo + '><v>' + v + '</v></c>';
    }
    return '<c r="' + ref + '"' + estilo + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  }

  function xmlHoja(h) {
    var out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    out += '<sheetViews><sheetView workbookViewId="0"' + (h.indice === 0 ? ' tabSelected="1"' : '') + '>';
    if (h.congelar) {
      out += '<pane ySplit="' + h.congelar + '" topLeftCell="A' + (h.congelar + 1) + '" activePane="bottomLeft" state="frozen"/>';
    }
    out += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';

    if (h.anchos && h.anchos.length) {
      out += '<cols>' + h.anchos.map(function (w, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      }).join('') + '</cols>';
    }

    out += '<sheetData>';
    h.filas.forEach(function (fila, r) {
      var celdas = (fila || []).map(function (c, i) { return xmlCelda(letra(i) + (r + 1), c); }).join('');
      out += '<row r="' + (r + 1) + '">' + celdas + '</row>';
    });
    out += '</sheetData>';

    if (h.filtro) { out += '<autoFilter ref="' + h.filtro + '"/>'; }
    out += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup orientation="landscape" fitToHeight="0"/></worksheet>';
    return out;
  }

  /* ---------- Zip sin compresión ---------- */

  var TABLA_CRC = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) { c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(archivos) {
    var codif = new TextEncoder();
    var partes = [];
    var central = [];
    var pos = 0;

    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    var HORA = 0, FECHA = (46 << 9) | (1 << 5) | 1; // 1-1-2026, fija para que el fichero sea reproducible

    archivos.forEach(function (a) {
      var nombre = codif.encode(a.nombre);
      var datos = codif.encode(a.contenido);
      var crc = crc32(datos);
      var cab = [].concat(
        u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(HORA), u16(FECHA),
        u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0)
      );
      partes.push(new Uint8Array(cab), nombre, datos);
      central.push({ nombre: nombre, crc: crc, tam: datos.length, pos: pos });
      pos += cab.length + nombre.length + datos.length;
    });

    var inicioCentral = pos;
    central.forEach(function (c) {
      var reg = [].concat(
        u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(HORA), u16(FECHA),
        u32(c.crc), u32(c.tam), u32(c.tam), u16(c.nombre.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(c.pos)
      );
      partes.push(new Uint8Array(reg), c.nombre);
      pos += reg.length + c.nombre.length;
    });
    var tamCentral = pos - inicioCentral;
    partes.push(new Uint8Array([].concat(
      u32(0x06054B50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(tamCentral), u32(inicioCentral), u16(0)
    )));

    var total = partes.reduce(function (t, p) { return t + p.length; }, 0);
    var out = new Uint8Array(total);
    var o = 0;
    partes.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  /* hojas: [{ nombre, filas, anchos, congelar, filtro }] → Uint8Array del .xlsx */
  function libro(hojas) {
    hojas.forEach(function (h, i) { h.indice = i; });
    var archivos = [
      {
        nombre: '[Content_Types].xml',
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          hojas.map(function (h, i) {
            return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
          }).join('') + '</Types>'
      },
      {
        nombre: '_rels/.rels',
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
      },
      {
        nombre: 'xl/workbook.xml',
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<bookViews><workbookView/></bookViews><sheets>' +
          hojas.map(function (h, i) {
            return '<sheet name="' + esc(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
          }).join('') + '</sheets>' +
          (hojas.some(function (h) { return h.filtro; })
            ? '<definedNames>' + hojas.map(function (h, i) {
                if (!h.filtro) { return ''; }
                var rango = h.filtro.split(':').map(function (c) { return '$' + c.replace(/(\d+)/, '$$$1'); }).join(':');
                return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(h.nombre) + '\'!' + rango + '</definedName>';
              }).join('') + '</definedNames>'
            : '') +
          '</workbook>'
      },
      {
        nombre: 'xl/_rels/workbook.xml.rels',
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          hojas.map(function (h, i) {
            return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
          }).join('') +
          '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
      },
      { nombre: 'xl/styles.xml', contenido: STYLES }
    ];
    hojas.forEach(function (h, i) {
      archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', contenido: xmlHoja(h) });
    });
    return zip(archivos);
  }

  App.xlsx = { libro: libro, ESTILO: ESTILO, letra: letra };
})(window.App = window.App || {});
