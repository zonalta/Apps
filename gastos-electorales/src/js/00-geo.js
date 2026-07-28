/* Estructura territorial electoral de Canarias.
   Provincia > Isla > Municipio. Los códigos son los del INE (35xxx Las Palmas,
   38xxx Santa Cruz de Tenerife). Los colegios electorales no se modelan todavía;
   la unidad de cálculo es la mesa, que cuelga directamente del municipio. */
(function (App) {
  'use strict';

  var PROVINCIAS = [
    { id: '35', nombre: 'Las Palmas' },
    { id: '38', nombre: 'Santa Cruz de Tenerife' }
  ];

  var ISLAS = [
    { id: '351', nombre: 'Fuerteventura', provincia: '35' },
    { id: '352', nombre: 'Gran Canaria', provincia: '35' },
    { id: '353', nombre: 'Lanzarote', provincia: '35' },
    { id: '381', nombre: 'La Gomera', provincia: '38' },
    { id: '382', nombre: 'El Hierro', provincia: '38' },
    { id: '383', nombre: 'La Palma', provincia: '38' },
    { id: '384', nombre: 'Tenerife', provincia: '38' }
  ];

  /* [codigo, nombre, isla] */
  var M = [
    ['35001', 'Agaete', '352'],
    ['35002', 'Agüimes', '352'],
    ['35003', 'Antigua', '351'],
    ['35004', 'Arrecife', '353'],
    ['35005', 'Artenara', '352'],
    ['35006', 'Arucas', '352'],
    ['35007', 'Betancuria', '351'],
    ['35008', 'Firgas', '352'],
    ['35009', 'Gáldar', '352'],
    ['35010', 'Haría', '353'],
    ['35011', 'Ingenio', '352'],
    ['35012', 'Mogán', '352'],
    ['35013', 'Moya', '352'],
    ['35014', 'Oliva, La', '351'],
    ['35015', 'Pájara', '351'],
    ['35016', 'Palmas de Gran Canaria, Las', '352'],
    ['35017', 'Puerto del Rosario', '351'],
    ['35018', 'San Bartolomé', '353'],
    ['35019', 'San Bartolomé de Tirajana', '352'],
    ['35020', 'Aldea de San Nicolás, La', '352'],
    ['35021', 'Santa Brígida', '352'],
    ['35022', 'Santa Lucía de Tirajana', '352'],
    ['35023', 'Santa María de Guía de Gran Canaria', '352'],
    ['35024', 'Teguise', '353'],
    ['35025', 'Tejeda', '352'],
    ['35026', 'Telde', '352'],
    ['35027', 'Teror', '352'],
    ['35028', 'Tías', '353'],
    ['35029', 'Tinajo', '353'],
    ['35030', 'Tuineje', '351'],
    ['35031', 'Valsequillo de Gran Canaria', '352'],
    ['35032', 'Valleseco', '352'],
    ['35033', 'Vega de San Mateo', '352'],
    ['35034', 'Yaiza', '353'],

    ['38001', 'Adeje', '384'],
    ['38002', 'Agulo', '381'],
    ['38003', 'Alajeró', '381'],
    ['38004', 'Arafo', '384'],
    ['38005', 'Arico', '384'],
    ['38006', 'Arona', '384'],
    ['38007', 'Barlovento', '383'],
    ['38008', 'Breña Alta', '383'],
    ['38009', 'Breña Baja', '383'],
    ['38010', 'Buenavista del Norte', '384'],
    ['38011', 'Candelaria', '384'],
    ['38012', 'Fasnia', '384'],
    ['38013', 'Frontera', '382'],
    ['38014', 'Fuencaliente de la Palma', '383'],
    ['38015', 'Garachico', '384'],
    ['38016', 'Garafía', '383'],
    ['38017', 'Granadilla de Abona', '384'],
    ['38018', 'Guancha, La', '384'],
    ['38019', 'Guía de Isora', '384'],
    ['38020', 'Güímar', '384'],
    ['38021', 'Hermigua', '381'],
    ['38022', 'Icod de los Vinos', '384'],
    ['38023', 'San Cristóbal de La Laguna', '384'],
    ['38024', 'Llanos de Aridane, Los', '383'],
    ['38025', 'Matanza de Acentejo, La', '384'],
    ['38026', 'Orotava, La', '384'],
    ['38027', 'Paso, El', '383'],
    ['38028', 'Puerto de la Cruz', '384'],
    ['38029', 'Puntagorda', '383'],
    ['38030', 'Puntallana', '383'],
    ['38031', 'Realejos, Los', '384'],
    ['38032', 'Rosario, El', '384'],
    ['38033', 'San Andrés y Sauces', '383'],
    ['38034', 'San Juan de la Rambla', '384'],
    ['38035', 'San Miguel de Abona', '384'],
    ['38036', 'San Sebastián de la Gomera', '381'],
    ['38037', 'Santa Cruz de la Palma', '383'],
    ['38038', 'Santa Cruz de Tenerife', '384'],
    ['38039', 'Santa Úrsula', '384'],
    ['38040', 'Santiago del Teide', '384'],
    ['38041', 'Sauzal, El', '384'],
    ['38042', 'Silos, Los', '384'],
    ['38043', 'Tacoronte', '384'],
    ['38044', 'Tanque, El', '384'],
    ['38045', 'Tazacorte', '383'],
    ['38046', 'Tegueste', '384'],
    ['38047', 'Tijarafe', '383'],
    ['38048', 'Valverde', '382'],
    ['38049', 'Valle Gran Rey', '381'],
    ['38050', 'Vallehermoso', '381'],
    ['38051', 'Victoria de Acentejo, La', '384'],
    ['38052', 'Vilaflor de Chasna', '384'],
    ['38053', 'Villa de Mazo', '383'],
    ['38901', 'Pinar de El Hierro, El', '382']
  ];

  var islaPorId = {};
  ISLAS.forEach(function (i) { islaPorId[i.id] = i; });

  var MUNICIPIOS = M.map(function (row) {
    return {
      codigo: row[0],
      nombre: row[1],
      isla: row[2],
      provincia: islaPorId[row[2]].provincia
    };
  });

  var porCodigo = {};
  MUNICIPIOS.forEach(function (m) { porCodigo[m.codigo] = m; });

  /* Índice de búsqueda por nombre normalizado, para casar los nombres que vengan
     en los ficheros CSV/Excel aunque lleguen sin código, en mayúsculas o con
     el artículo delante ("La Oliva" vs "Oliva, La"). */
  function normaliza(txt) {
    return String(txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9ñ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var ARTICULOS = ['la', 'el', 'los', 'las'];

  function variantes(nombre) {
    var base = normaliza(nombre);
    var out = [base];
    // "oliva, la" -> "la oliva"
    var m = /^(.*) (la|el|los|las)$/.exec(base);
    if (m) { out.push(m[2] + ' ' + m[1]); }
    // "la oliva" -> "oliva la"
    var partes = base.split(' ');
    if (ARTICULOS.indexOf(partes[0]) >= 0 && partes.length > 1) {
      out.push(partes.slice(1).join(' ') + ' ' + partes[0]);
      out.push(partes.slice(1).join(' '));
    }
    return out;
  }

  var indiceNombre = {};
  MUNICIPIOS.forEach(function (m) {
    variantes(m.nombre).forEach(function (v) {
      if (!(v in indiceNombre)) { indiceNombre[v] = m.codigo; }
    });
  });

  /* Resuelve una celda de municipio que puede venir como "35001", "35001 AGAETE",
     "AGAETE" o "Agaete (Las Palmas)". Devuelve el código o null. */
  function resolverMunicipio(valor) {
    if (valor == null) { return null; }
    var txt = String(valor).trim();
    if (!txt) { return null; }

    var codigo = /(\d{5})/.exec(txt);
    if (codigo && porCodigo[codigo[1]]) { return codigo[1]; }

    var sinCodigo = txt.replace(/^\s*\d+\s*[-.]?\s*/, '');
    var candidatos = variantes(sinCodigo);
    for (var i = 0; i < candidatos.length; i++) {
      if (indiceNombre[candidatos[i]]) { return indiceNombre[candidatos[i]]; }
    }
    return null;
  }

  /* Formas en que un fichero puede nombrar a cada provincia. Sirve para
     contrastar la columna PROVINCIA, cuando existe, contra la que le
     corresponde al municipio por su código. */
  var ALIAS_PROVINCIA = {
    '35': ['35', 'las palmas', 'palmas las', 'palmas', 'provincia de las palmas'],
    '38': ['38', 'santa cruz de tenerife', 's c de tenerife', 'sc de tenerife',
      'sta cruz de tenerife', 'santa cruz tenerife', 'tenerife',
      'provincia de santa cruz de tenerife']
  };

  /* Clave de orden alfabético: "Oliva, La" y "La Oliva" deben alfabetizarse
     por "Oliva", no por el artículo. */
  function claveOrden(nombre) {
    var base = String(nombre || '');
    var conComa = /^(.*), (La|El|Los|Las)$/.exec(base);
    if (conComa) { return conComa[1]; }
    var conArticulo = /^(La|El|Los|Las) (.*)$/.exec(base);
    if (conArticulo) { return conArticulo[2]; }
    return base;
  }

  /* Compara dos nombres de isla o municipio ignorando el artículo, en
     cualquiera de sus dos formas ("La Gomera" o "Gomera, La"). Sirve tanto
     para ordenar listas como para ordenar columnas de una tabla. */
  function compararNombres(a, b) {
    return normaliza(claveOrden(a)).localeCompare(normaliza(claveOrden(b)), 'es');
  }

  /* Copia ordenada alfabéticamente (por nombre, ignorando el artículo) de
     cualquier lista de islas o municipios. No toca el orden original, que se
     conserva por si algo depende de él (ninguna parte del cálculo lo hace,
     pero el orden de origen sigue siendo el del código INE). */
  function ordenarPorNombre(lista) {
    return lista.slice().sort(function (a, b) { return compararNombres(a.nombre, b.nombre); });
  }

  /* Devuelve '35', '38' o null si el texto no identifica ninguna provincia. */
  function provinciaDeTexto(valor) {
    var norm = normaliza(valor);
    if (!norm) { return null; }
    var encontrada = null;
    Object.keys(ALIAS_PROVINCIA).forEach(function (id) {
      if (ALIAS_PROVINCIA[id].indexOf(norm) >= 0) { encontrada = id; }
    });
    return encontrada;
  }

  /* Cuando una celda trae código y nombre juntos ("35001 AGAETE"), comprueba que
     se refieran al mismo municipio. Un desajuste significa que el fichero sigue
     otra codificación, y hay que avisar: importar por código sin más ruido
     colgaría los datos del municipio equivocado en silencio. */
  function discrepancia(valor, codigo) {
    var txt = String(valor == null ? '' : valor).trim();
    var resto = txt.replace(/\d{5}/, '').replace(/^[\s\-.:;,]+/, '').trim();
    if (!resto || !porCodigo[codigo]) { return null; }

    var esperadas = variantes(porCodigo[codigo].nombre);
    var recibida = normaliza(resto);
    if (!recibida) { return null; }
    if (esperadas.indexOf(recibida) >= 0) { return null; }

    return {
      texto: txt,
      codigo: codigo,
      nombreEsperado: porCodigo[codigo].nombre
    };
  }

  App.geo = {
    PROVINCIAS: PROVINCIAS,
    ISLAS: ISLAS,
    MUNICIPIOS: MUNICIPIOS,
    municipio: function (codigo) { return porCodigo[codigo] || null; },
    isla: function (id) { return islaPorId[id] || null; },
    provincia: function (id) {
      for (var i = 0; i < PROVINCIAS.length; i++) {
        if (PROVINCIAS[i].id === id) { return PROVINCIAS[i]; }
      }
      return null;
    },
    islasDe: function (provinciaId) {
      return ISLAS.filter(function (i) { return i.provincia === provinciaId; });
    },
    municipiosDe: function (islaId) {
      return MUNICIPIOS.filter(function (m) { return m.isla === islaId; });
    },
    normaliza: normaliza,
    resolverMunicipio: resolverMunicipio,
    discrepancia: discrepancia,
    provinciaDeTexto: provinciaDeTexto,
    ordenarPorNombre: ordenarPorNombre,
    compararNombres: compararNombres
  };
})(window.App = window.App || {});
