/* Quién puede entrar a la aplicación, más allá de lo fijado al desplegar, y con
   qué papel. Hay tres niveles:
     - Administrador: los correos de CORREOS_AUTORIZADOS. Fijos, sólo cambian
       volviendo a desplegar el servicio. Nunca se pueden quitar desde la app,
       así que un descuido gestionando usuarios nunca deja a todos fuera de su
       propia aplicación. Acceso completo, incluida la gestión de usuarios.
     - Editor: colaborador con acceso a todo salvo gestionar quién entra.
     - Consulta: colaborador limitado al Dashboard de Informes — puede ver,
       filtrar, ordenar y exportar, pero no tocar Configuración de Importes ni
       Carga de Datos. Ese límite lo impone el servidor rechazando cualquier
       guardado de estado (PUT /api/estado) que venga de una sesión de consulta,
       así que no basta con ocultar los botones en el navegador.
   Los colaboradores (editor o consulta) se guardan en Firestore; sólo un
   administrador puede añadirlos, quitarlos o decidir su papel. */
'use strict';

const ADMINISTRADORES = (process.env.CORREOS_AUTORIZADOS || '')
  .split(',')
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

const ROLES = ['editor', 'consulta'];
const ROL_POR_DEFECTO = 'editor';

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

/* Los colaboradores guardados antes de que existieran los papeles no tienen
   `rol`: se tratan como editor, que es el acceso que ya tenían. */
function validarRol(rol) {
  if (rol == null) { return ROL_POR_DEFECTO; }
  if (ROLES.indexOf(rol) < 0) {
    const err = new Error('El papel debe ser «editor» o «consulta».');
    err.estado = 400;
    throw err;
  }
  return rol;
}

function normalizarRol(colaborador) {
  return Object.assign({}, colaborador, { rol: colaborador.rol || ROL_POR_DEFECTO });
}

/* ---------- Implementación en memoria (desarrollo) ---------- */

function almacenEnMemoria() {
  let colaboradores = [];
  return {
    async listar() { return colaboradores.map(normalizarRol); },
    async agregar(correo, quien, rol) {
      correo = validarCorreo(correo);
      rol = validarRol(rol);
      if (esAdmin(correo)) {
        const err = new Error('Ese correo ya es administrador: siempre tiene acceso.');
        err.estado = 409;
        throw err;
      }
      colaboradores = colaboradores.filter((c) => c.correo !== correo);
      colaboradores.push({ correo, rol, anadidoPor: quien, fecha: new Date().toISOString() });
      return colaboradores.map(normalizarRol);
    },
    async quitar(correo) {
      correo = String(correo || '').trim().toLowerCase();
      colaboradores = colaboradores.filter((c) => c.correo !== correo);
      return colaboradores.map(normalizarRol);
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
    async listar() { return (await leer()).map(normalizarRol); },
    async agregar(correo, quien, rol) {
      correo = validarCorreo(correo);
      rol = validarRol(rol);
      if (esAdmin(correo)) {
        const err = new Error('Ese correo ya es administrador: siempre tiene acceso.');
        err.estado = 409;
        throw err;
      }
      const actuales = (await leer()).filter((c) => c.correo !== correo);
      actuales.push({ correo, rol, anadidoPor: quien, fecha: new Date().toISOString() });
      await ref.set({ colaboradores: actuales });
      return actuales.map(normalizarRol);
    },
    async quitar(correo) {
      correo = String(correo || '').trim().toLowerCase();
      const actuales = (await leer()).filter((c) => c.correo !== correo);
      await ref.set({ colaboradores: actuales });
      return actuales.map(normalizarRol);
    }
  };
}

const backend = (process.env.ALMACEN || 'firestore').toLowerCase() === 'memoria'
  ? almacenEnMemoria()
  : almacenFirestore();

/* 'administrador' | 'editor' | 'consulta' | null si no tiene acceso. Es lo que
   decide, en el servidor, qué puede hacer cada sesión. */
async function rolDe(correo) {
  const limpio = String(correo || '').toLowerCase();
  if (esAdmin(limpio)) { return 'administrador'; }
  const colaboradores = await backend.listar();
  const encontrado = colaboradores.find((c) => c.correo === limpio);
  return encontrado ? encontrado.rol : null;
}

module.exports = {
  ADMINISTRADORES,
  ROLES,
  esAdmin,
  rolDe,
  listar: () => backend.listar(),
  agregar: (correo, quien, rol) => backend.agregar(correo, quien, rol),
  quitar: (correo) => backend.quitar(correo)
};
