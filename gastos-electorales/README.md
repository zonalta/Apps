# Gestión Electoral — Gastos de colaboradores (Canarias)

Cálculo, listados e informes del gasto en colaboradores de un proceso electoral,
organizado por la estructura territorial canaria: **provincia → isla → municipio → mesa**.

## Estado actual

Aplicación funcional que se ejecuta entera en el navegador. Los datos se guardan
en `localStorage`, es decir **por dispositivo**: todavía no hay servidor, así que
lo cargado en el iPad no aparece en el ordenador. La pantalla «Carga de Datos»
incluye exportar/restaurar una copia en JSON para salvar ese hueco mientras tanto.

El siguiente paso previsto es empaquetar la app con un backend y desplegarla en
Cloud Run, momento en el que los datos pasan a ser compartidos entre dispositivos.

## Cómo se ejecuta

```bash
node build.js          # genera dist/ a partir de src/
```

- `dist/index.html` — la aplicación completa en un único fichero. Se abre con
  doble clic o se sirve como estático.
- `dist/vista-previa.html` — el mismo contenido sin el envoltorio `<html>`, para
  publicarlo como página de vista previa.

No hay dependencias ni `node_modules`: `build.js` sólo concatena `src/`.

## Estructura

| Fichero | Responsabilidad |
|---|---|
| `src/js/00-geo.js` | Los 88 municipios de Canarias con su isla y provincia, y el reconocimiento de nombres al importar |
| `src/js/10-state.js` | Estado, persistencia y catálogo de tipologías de colaborador |
| `src/js/20-parsers.js` | Lectura de CSV y XLSX |
| `src/js/30-calc.js` | Motor de cálculo — **todo el dinero se calcula aquí** |
| `src/js/40-ui.js` | Formato, construcción de nodos y gráficas de barras |
| `src/js/50-vista-config.js` | Configuración de importes |
| `src/js/60-vista-datos.js` | Carga de ficheros y copia de seguridad |
| `src/js/70-vista-dashboard.js` | Filtros, indicadores, gráficas y tablas |
| `src/js/90-app.js` | Navegación y arranque |

## Reglas de cálculo implementadas

| Colaborador | Cálculo |
|---|---|
| Representantes de la Administración | Σ (nº de cada tipología PD0–PD5 × su tarifa) |
| Secretarios de Ayuntamiento | 1 por municipio; tarifa según tramo de mesas (≤10 / 11–50 / >50) |
| Jueces de Paz | Importe fijo, 1 por municipio |
| Acondicionamiento de locales | Tarifa × mesas del municipio |
| Personal colaborador | Tarifa × mesas del municipio |
| Montaje y transporte | Tarifa × mesas del municipio |
| Policía Autonómica y Local | Tarifa por efectivo × efectivos del municipio |
| Miembros de mesas electorales | Tarifa × 3 miembros × mesas del municipio |
| Coordinadores de tablets | (nº tramo ≤10 × su tarifa) + (nº tramo ≥11 × su tarifa) — **no territorializado** |

Los cálculos están verificados con una prueba en navegador que recalcula el total
por una vía independiente y comprueba que la suma por isla, por provincia y por
tipología coincide con el total general.

## Decisiones tomadas donde el briefing no llegaba

Estas son interpretaciones, no hechos: conviene confirmarlas.

1. **De dónde salen las mesas.** El briefing dice que casi todo se calcula sobre
   el número de mesas del municipio, pero no dice cómo entra ese dato. Se ha
   añadido una tercera carga de fichero («Mesas por municipio») junto a las dos
   que sí estaban previstas. Si las mesas llegan por otra vía, esta parte cambia.

2. **Qué es un municipio "activo".** Los conceptos que se cobran por municipio
   —secretario y juez de paz— sólo devengan en municipios con mesas cargadas.
   Un municipio con 0 mesas aporta 0 €, en lugar de cobrar secretario y juez.

3. **Coordinadores de tablets.** El briefing pide dos tarifas (colegios de hasta
   10 mesas y de 11 o más) pero habla de cargar «el número total». Un total único
   no se puede repartir entre dos tarifas, así que se piden **dos cantidades**,
   una por tramo. Su importe nunca se suma a municipios, islas ni provincias:
   aparece siempre en su propia tarjeta y sólo entra en el total general.

4. **Miembros por mesa.** Fijado en 3 según el briefing, pero configurable, por
   si cambia entre convocatorias.

5. **Códigos de municipio.** Verificados uno a uno contra el fichero oficial
   *Municipios Canarias enero 2025 (INE)*. Los 88 coinciden en código, nombre e
   isla. Los identificadores de isla son los `CISLA` del propio INE (351
   Fuerteventura, 352 Gran Canaria, 353 Lanzarote, 381 La Gomera, 382 El Hierro,
   383 La Palma, 384 Tenerife), no códigos inventados.

   La tabla se regenera desde el Excel del INE, no se edita a mano. Cuando el
   INE publique una revisión, hay que volver a generarla desde la fuente en vez
   de parchear entradas sueltas.

## Formato de los ficheros de carga

Se acepta CSV (con `;`, `,` o tabulador) y Excel `.xlsx`. El `.xls` antiguo no.
El municipio se reconoce por código (`35001`), por nombre (`AGAETE`), por ambos
(`35001 AGAETE`) y con el artículo en cualquier posición (`La Oliva` u `Oliva, La`).

```
MUNICIPIOS;PD0;PD1;PD2;PD3;PD4;PD5
35001 AGAETE;5;2;2;0;1;0
```

Desde «Carga de Datos» se descargan las tres plantillas ya rellenas con los 88
municipios.

La importación hace dos comprobaciones y avisa de ambas en pantalla:

- **Municipio no reconocido** — la fila se ignora y se dice cuál era.
- **Código y nombre en desacuerdo** — cuando la celda trae los dos («35001
  AGAETE») y no se refieren al mismo municipio. Los datos se importan usando el
  código, pero se avisa: sin este aviso, un fichero con otra codificación
  colgaría las cifras del municipio equivocado sin que nadie se enterase.

## Informes

Los filtros de provincia, isla, municipio y tipología son listas de casillas
independientes con «Todos» / «Ninguno», y se propagan hacia abajo: desmarcar una
provincia desmarca sus islas y sus municipios.

El desglose se ve en cinco agrupaciones (municipio, isla, provincia, colaborador
y línea a línea) y se descarga en CSV. «Exportar a PDF» abre el diálogo de
impresión con una hoja preparada: título, convocatoria, fecha de generación,
ámbito del informe, indicadores, gráficas y la tabla completa.

## Pendiente

- Backend y despliegue en Cloud Run, para que los datos se compartan entre dispositivos.
- Colegios electorales como nivel entre municipio y mesa; con ellos, los
  coordinadores de tablets dejarían de ser un importe suelto.
- Historial de informes generados.
