/* Almacenamiento de la convocatoria.
   Hay dos implementaciones tras la misma interfaz: Firestore para producción y
   una en memoria para desarrollo y pruebas. Así el resto del servidor se puede
   ejercitar sin depender de Google. */
'use strict';

/* Los datos de una convocatoria caben de sobra en un único documento (unos
   pocos KB para los 88 municipios), así que se guardan juntos. Eso hace que
   cada guardado sea atómico: nunca queda medio escrito. */
const COLECCION = 'convocatorias';
const DOCUMENTO = 'activa';

function datosVacios() {
  return {
    convocatoria: 'Proceso electoral',
    config: null,
    mesas: {},
    representantes: {},
    policia: {},
    cargas: {}
  };
}

/* ---------- Implementación en memoria ---------- */

function almacenEnMemoria() {
  let registro = { version: 0, datos: datosVacios(), actualizado: null, actualizadoPor: null };

  return {
    tipo: 'memoria',
    async leer() {
      return JSON.parse(JSON.stringify(registro));
    },
    async guardar(versionEsperada, datos, correo) {
      if (registro.version !== versionEsperada) {
        const err = new Error('conflicto');
        err.conflicto = true;
        err.actual = JSON.parse(JSON.stringify(registro));
        throw err;
      }
      registro = {
        version: registro.version + 1,
        datos: JSON.parse(JSON.stringify(datos)),
        actualizado: new Date().toISOString(),
        actualizadoPor: correo
      };
      return JSON.parse(JSON.stringify(registro));
    }
  };
}

/* ---------- Implementación con Firestore ---------- */

function almacenFirestore() {
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ ignoreUndefinedProperties: true });
  const ref = db.collection(COLECCION).doc(DOCUMENTO);

  function aRegistro(snap) {
    if (!snap.exists) {
      return { version: 0, datos: datosVacios(), actualizado: null, actualizadoPor: null };
    }
    const d = snap.data();
    return {
      version: d.version || 0,
      datos: d.datos || datosVacios(),
      actualizado: d.actualizado ? d.actualizado.toDate().toISOString() : null,
      actualizadoPor: d.actualizadoPor || null
    };
  }

  return {
    tipo: 'firestore',
    async leer() {
      return aRegistro(await ref.get());
    },

    /* La escritura va en transacción y comprueba la versión: si otro dispositivo
       guardó entre medias, se rechaza en vez de pisar su trabajo en silencio. */
    async guardar(versionEsperada, datos, correo) {
      return db.runTransaction(async (tx) => {
        const actual = aRegistro(await tx.get(ref));
        if (actual.version !== versionEsperada) {
          const err = new Error('conflicto');
          err.conflicto = true;
          err.actual = actual;
          throw err;
        }
        const nuevo = {
          version: actual.version + 1,
          datos: datos,
          actualizado: new Date(),
          actualizadoPor: correo
        };
        tx.set(ref, nuevo);
        return {
          version: nuevo.version,
          datos: datos,
          actualizado: nuevo.actualizado.toISOString(),
          actualizadoPor: correo
        };
      });
    }
  };
}

function crearAlmacen() {
  const tipo = (process.env.ALMACEN || 'firestore').toLowerCase();
  if (tipo === 'memoria') {
    console.warn('ALMACEN=memoria — los datos se pierden al reiniciar. Sólo para desarrollo.');
    return almacenEnMemoria();
  }
  return almacenFirestore();
}

module.exports = { crearAlmacen, datosVacios };
