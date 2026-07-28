/* Quién puede entrar a la aplicación, más allá de lo fijado al desplegar.
   Hay dos niveles:
     - Administradores: los correos de CORREOS_AUTORIZADOS. Fijos, sólo
       cambian volviendo a desplegar el servicio. Nunca se pueden quitar desde
       la app, así que un descuido gestionando usuarios nunca deja a todos
       fuera de su propia aplicación.
     - Colaboradores: correos añadidos desde la propia app, guardados en
       Firestore. Sólo un administrador puede añadir o quitar colaboradores;
       un colaborador no puede dar acceso a nadie más. */
'use strict';

const ADMINISTRADORES = (process.env.CORREOS_AUTORIZADOS || '')
  .split(',')
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

const COLECCION = 'configuracion';
const DOCUMENTO = 'accesos';

function esAdmin(correo) {
  return ADMINISTRADORES.indexOf(String(correo || '').toLowerCase()) >= 0;
}

function validarCorreo(correo) {
  const limpio = String(correo || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio) || limpio.length > 200) {
    const err = new Error('«' + correo + '» no parece un correo electrónico válido.');
    err.estado = 400;
    throw err;
  }
  return limpio;
}

/* ---------- Implementación en memoria (desarrollo) ---------- */

function almacenEnMemoria() {
  let colaboradores = [];
  return {
    async listar() { return colaboradores; },
    async agregar(correo, quien) {
      correo = validarCorreo(correo);
      if (esAdmin(correo)) {
        const err = new Error('Ese correo ya es administrador: siempre tiene acceso.');
        err.estado = 409;
        throw err;
      }
      if (!colaboradores.some((c) => c.correo === correo)) {
        colaboradores.push({ correo, anadidoPor: quien, fecha: new Date().toISOString() });
      }
      return colaboradores;
    },
    async quitar(correo) {
      correo = String(correo || '').trim().toLowerCase();
      colaboradores = colaboradores.filter((c) => c.correo !== correo);
      return colaboradores;
    }
  };
}

/* ---------- Implementación con Firestore ---------- */

function almacenFirestore() {
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ ignoreUndefinedProperties: true });
  const ref = db.collection(COLECCION).doc(DOCUMENTO);

  async function leer() {
    const snap = await ref.get();
    return snap.exists ? (snap.data().colaboradores || []) : [];
  }

  return {
    async listar() { return leer(); },
    async agregar(correo, quien) {
      correo = validarCorreo(correo);
      if (esAdmin(correo)) {
        const err = new Error('Ese correo ya es administrador: siempre tiene acceso.');
        err.estado = 409;
        throw err;
      }
      const actuales = await leer();
      if (!actuales.some((c) => c.correo === correo)) {
        actuales.push({ correo, anadidoPor: quien, fecha: new Date().toISOString() });
        await ref.set({ colaboradores: actuales });
      }
      return actuales;
    },
    async quitar(correo) {
      correo = String(correo || '').trim().toLowerCase();
      const actuales = (await leer()).filter((c) => c.correo !== correo);
      await ref.set({ colaboradores: actuales });
      return actuales;
    }
  };
}

const backend = (process.env.ALMACEN || 'firestore').toLowerCase() === 'memoria'
  ? almacenEnMemoria()
  : almacenFirestore();

async function estaAutorizado(correo) {
  const limpio = String(correo || '').toLowerCase();
  if (esAdmin(limpio)) { return true; }
  const colaboradores = await backend.listar();
  return colaboradores.some((c) => c.correo === limpio);
}

module.exports = {
  ADMINISTRADORES,
  esAdmin,
  estaAutorizado,
  listar: () => backend.listar(),
  agregar: (correo, quien) => backend.agregar(correo, quien),
  quitar: (correo) => backend.quitar(correo)
};
