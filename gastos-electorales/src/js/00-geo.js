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
    { id: 'GC', nombre: 'Gran Canaria', provincia: '35' },
    { id: 'LZ', nombre: 'Lanzarote', provincia: '35' },
    { id: 'FV', nombre: 'Fuerteventura', provincia: '35' },
    { id: 'TF', nombre: 'Tenerife', provincia: '38' },
    { id: 'LP', nombre: 'La Palma', provincia: '38' },
    { id: 'LG', nombre: 'La Gomera', provincia: '38' },
    { id: 'EH', nombre: 'El Hierro', provincia: '38' }
  ];

  /* [codigo, nombre, isla] */
  var M = [
    ['35001', 'Agaete', 'GC'],
    ['35002', 'Agüimes', 'GC'],
    ['35003', 'Antigua', 'FV'],
    ['35004', 'Arrecife', 'LZ'],
    ['35005', 'Artenara', 'GC'],
    ['35006', 'Arucas', 'GC'],
    ['35007', 'Betancuria', 'FV'],
    ['35008', 'Firgas', 'GC'],
    ['35009', 'Gáldar', 'GC'],
    ['35010', 'Haría', 'LZ'],
    ['35011', 'Ingenio', 'GC'],
    ['35012', 'Mogán', 'GC'],
    ['35013', 'Moya', 'GC'],
    ['35014', 'Oliva, La', 'FV'],
    ['35015', 'Pájara', 'FV'],
    ['35016', 'Palmas de Gran Canaria, Las', 'GC'],
    ['35017', 'Puerto del Rosario', 'FV'],
    ['35018', 'San Bartolomé', 'LZ'],
    ['35019', 'San Bartolomé de Tirajana', 'GC'],
    ['35020', 'Aldea de San Nicolás, La', 'GC'],
    ['35021', 'Santa Brígida', 'GC'],
    ['35022', 'Santa Lucía de Tirajana', 'GC'],
    ['35023', 'Santa María de Guía de Gran Canaria', 'GC'],
    ['35024', 'Teguise', 'LZ'],
    ['35025', 'Tejeda', 'GC'],
    ['35026', 'Telde', 'GC'],
    ['35027', 'Teror', 'GC'],
    ['35028', 'Tías', 'LZ'],
    ['35029', 'Tinajo', 'LZ'],
    ['35030', 'Tuineje', 'FV'],
    ['35031', 'Valsequillo de Gran Canaria', 'GC'],
    ['35032', 'Valleseco', 'GC'],
    ['35033', 'Vega de San Mateo', 'GC'],
    ['35034', 'Yaiza', 'LZ'],

    ['38001', 'Adeje', 'TF'],
    ['38002', 'Agulo', 'LG'],
    ['38003', 'Alajeró', 'LG'],
    ['38004', 'Arafo', 'TF'],
    ['38005', 'Arico', 'TF'],
    ['38006', 'Arona', 'TF'],
    ['38007', 'Barlovento', 'LP'],
    ['38008', 'Breña Alta', 'LP'],
    ['38009', 'Breña Baja', 'LP'],
    ['38010', 'Buenavista del Norte', 'TF'],
    ['38011', 'Candelaria', 'TF'],
    ['38012', 'Fasnia', 'TF'],
    ['38013', 'Frontera', 'EH'],
    ['38014', 'Fuencaliente de la Palma', 'LP'],
    ['38015', 'Garachico', 'TF'],
    ['38016', 'Garafía', 'LP'],
    ['38017', 'Granadilla de Abona', 'TF'],
    ['38018', 'Guancha, La', 'TF'],
    ['38019', 'Guía de Isora', 'TF'],
    ['38020', 'Güímar', 'TF'],
    ['38021', 'Hermigua', 'LG'],
    ['38022', 'Icod de los Vinos', 'TF'],
    ['38023', 'Llanos de Aridane, Los', 'LP'],
    ['38024', 'Matanza de Acentejo, La', 'TF'],
    ['38025', 'Orotava, La', 'TF'],
    ['38026', 'Paso, El', 'LP'],
    ['38027', 'Puerto de la Cruz', 'TF'],
    ['38028', 'Puntagorda', 'LP'],
    ['38029', 'Puntallana', 'LP'],
    ['38030', 'Realejos, Los', 'TF'],
    ['38031', 'Rosario, El', 'TF'],
    ['38032', 'San Andrés y Sauces', 'LP'],
    ['38033', 'San Cristóbal de La Laguna', 'TF'],
    ['38034', 'San Juan de la Rambla', 'TF'],
    ['38035', 'San Miguel de Abona', 'TF'],
    ['38036', 'San Sebastián de la Gomera', 'LG'],
    ['38037', 'Santa Cruz de la Palma', 'LP'],
    ['38038', 'Santa Cruz de Tenerife', 'TF'],
    ['38039', 'Santa Úrsula', 'TF'],
    ['38040', 'Santiago del Teide', 'TF'],
    ['38041', 'Sauzal, El', 'TF'],
    ['38042', 'Silos, Los', 'TF'],
    ['38043', 'Tacoronte', 'TF'],
    ['38044', 'Tanque, El', 'TF'],
    ['38045', 'Tazacorte', 'LP'],
    ['38046', 'Tegueste', 'TF'],
    ['38047', 'Tijarafe', 'LP'],
    ['38048', 'Valle Gran Rey', 'LG'],
    ['38049', 'Vallehermoso', 'LG'],
    ['38050', 'Valverde', 'EH'],
    ['38051', 'Victoria de Acentejo, La', 'TF'],
    ['38052', 'Vilaflor de Chasna', 'TF'],
    ['38053', 'Villa de Mazo', 'LP'],
    ['38901', 'Pinar de El Hierro, El', 'EH']
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
    resolverMunicipio: resolverMunicipio
  };
})(window.App = window.App || {});
