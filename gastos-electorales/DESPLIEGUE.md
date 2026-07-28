# Desplegar en Cloud Run

## Configurar la base de datos y el acceso

Se hace una sola vez, después del primer despliegue.

### 1. Firestore

```bash
PROYECTO=gen-lang-client-0903107323
gcloud config set project $PROYECTO
gcloud services enable firestore.googleapis.com

# Base de datos en modo nativo, en la misma región que el servicio
gcloud firestore databases create --location=europe-southwest1
```

La cuenta con la que corre Cloud Run necesita poder escribir:

```bash
NUMERO=$(gcloud projects describe $PROYECTO --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROYECTO \
  --member="serviceAccount:$NUMERO-compute@developer.gserviceaccount.com" \
  --role=roles/datastore.user --condition=None
```

### 2. Identificador de cliente de Google

En la consola, **APIs y servicios → Pantalla de consentimiento de OAuth**:

- Tipo de usuario: **Externo**
- Nombre de la aplicación: `Gestión Electoral`, y tu correo como contacto
- Ámbitos: no añadas ninguno. Sólo se usa la identidad, que va incluida.
- **Publica la aplicación** (estado «En producción»). Con ámbitos básicos no hace
  falta que Google la revise, y evita la lista de usuarios de prueba.

Luego en **Credenciales → Crear credenciales → ID de cliente de OAuth**:

- Tipo: **Aplicación web**
- Orígenes autorizados de JavaScript: la URL de Cloud Run, sin barra final
  (`https://gestion-electoral-635475980649.europe-southwest1.run.app`)
- No hace falta URI de redirección

Copia el **ID de cliente**. Es público por diseño: identifica a la aplicación, no
autoriza a nadie. El secreto que Google genera al lado **no se usa** y puede
ignorarse.

### 3. Decir al servicio quién puede entrar

```bash
gcloud run services update gestion-electoral \
  --region europe-southwest1 \
  --update-env-vars \
GOOGLE_CLIENT_ID=EL_ID_DE_CLIENTE,\
CORREOS_AUTORIZADOS=zonalta@gmail.com
```

Para dar acceso a más gente, se repite el comando con los correos separados por
comas. Para quitárselo a alguien, se repite sin él: el cambio es inmediato.

Comprobación:

```bash
curl https://TU-URL/_salud
# {"estado":"ok","almacen":"firestore","autenticacion":"configurada"}
```

### Por qué el servicio sigue siendo público en Cloud Run

Puede chocar, así que conviene explicarlo. Si se cerrara el servicio con IAM
(`--no-allow-unauthenticated`), Cloud Run rechazaría la petición **antes** de
servir nada, y el navegador no podría ni cargar la pantalla de acceso: haría
falta un proxy autenticado para abrirla, lo que la vuelve inservible desde el
iPad.

La protección está una capa más arriba, en la aplicación: sin una sesión de
Google válida y con el correo en la lista, la API no devuelve ni un dato. Lo
único que se puede ver sin identificarse es la pantalla de acceso.

Son dos cosas distintas y ambas necesarias: **Google comprueba quién eres**, y
`CORREOS_AUTORIZADOS` decide **si tú puedes entrar**. Que cualquiera pueda
iniciar sesión con su Google no le da acceso a nada.

## Variables del servicio

| Variable | Para qué | Obligatoria |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Identificador de cliente OAuth | Sí |
| `CORREOS_AUTORIZADOS` | Correos con acceso, separados por comas | Sí |
| `ALMACEN` | `firestore` (por defecto) o `memoria` para desarrollo | No |
| `AUTH_MODO` | `google` (por defecto) o `desarrollo`, que salta la verificación | No |

`AUTH_MODO=desarrollo` **no puede usarse en Cloud Run**: el servidor detecta que
está desplegado y se niega a arrancar. Es un cierre deliberado, para que un
descuido en el despliegue no deje la aplicación abierta.

## Antes de empezar: dos aclaraciones

**El nombre del servicio no puede ser «Gestión Electoral».** Cloud Run sólo admite
minúsculas, números y guiones, sin acentos ni espacios. El servicio se llama
**`gestion-electoral`**; «Gestión Electoral» es el nombre de la aplicación y el
que aparece dentro de ella.

**Los datos viven en Firestore y se comparten entre dispositivos.** El navegador
guarda una copia que sólo sirve de respaldo si se cae la conexión. Si la
aplicación se abre sin servidor detrás —fichero suelto o vista previa— funciona
igual pero en modo local, y lo dice en la barra lateral.

## Datos que hace falta tener a mano

| Dato | Cómo obtenerlo |
|---|---|
| **ID del proyecto** | No es el nombre visible «Claude Code» sino su identificador: `gcloud projects list` |
| **Región** | Se propone `europe-southwest1` (Madrid), la más cercana |
| **Facturación** | Debe estar activada en el proyecto; Cloud Run no despliega sin ella |

## Despliegue manual (la primera vez)

Con [gcloud instalado](https://cloud.google.com/sdk/docs/install) y sesión
iniciada (`gcloud auth login`):

```bash
# 1. Situarse en el proyecto correcto
gcloud projects list                          # localizar el ID de "Claude Code"
gcloud config set project TU_PROJECT_ID

# 2. Habilitar los servicios necesarios (una sola vez)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# 3. Desplegar, desde la raíz del repositorio
gcloud run deploy gestion-electoral \
  --source gastos-electorales \
  --region europe-southwest1 \
  --port 8080 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated
```

Google construye la imagen con el `Dockerfile` del proyecto, la sube a Artifact
Registry y publica el servicio. Al terminar imprime la URL, del estilo
`https://gestion-electoral-XXXXXXXX.europe-southwest1.run.app`.

Para comprobar que ha ido bien:

```bash
curl https://TU-URL/_salud     # {"estado":"ok","version":"gestion-electoral-00001-abc"}
```

## Sobre el acceso público

`--allow-unauthenticated` es **necesario** y no es un descuido: sin él, Cloud Run
rechazaría la petición antes de servir la pantalla de acceso. Está explicado más
arriba, en «Por qué el servicio sigue siendo público en Cloud Run».

Lo que protege los datos es la sesión de Google más la lista de correos
autorizados. Sin las dos cosas, la API no devuelve nada.

## Coste

El servicio escala a cero: sin visitas, no hay instancias y no se factura. Con
512 MiB, un uso de unas pocas personas cabe de sobra en la
[capa gratuita mensual](https://cloud.google.com/run/pricing) de Cloud Run.
El gasto realista es de céntimos, sobre todo por el almacenamiento de la imagen
en Artifact Registry.

Para no acumular imágenes viejas:

```bash
gcloud artifacts docker images list \
  europe-southwest1-docker.pkg.dev/TU_PROJECT_ID/cloud-run-source-deploy
```

## Despliegue automático desde GitHub

`.github/workflows/desplegar-cloud-run.yml` redespliega en cada push a `main`
que toque `gastos-electorales/`. Usa federación de identidades, de modo que no
hay ninguna clave descargada ni guardada en GitHub.

Configuración, una sola vez:

```bash
PROYECTO=TU_PROJECT_ID
NUMERO=$(gcloud projects describe $PROYECTO --format='value(projectNumber)')

# Cuenta de servicio que hará los despliegues
gcloud iam service-accounts create despliegue-github \
  --display-name="Despliegues desde GitHub Actions"

CUENTA=despliegue-github@$PROYECTO.iam.gserviceaccount.com

for ROL in roles/run.admin roles/cloudbuild.builds.editor \
           roles/artifactregistry.admin roles/iam.serviceAccountUser \
           roles/storage.admin; do
  gcloud projects add-iam-policy-binding $PROYECTO \
    --member="serviceAccount:$CUENTA" --role="$ROL"
done

# Depósito de identidades federadas para GitHub
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='zonalta/Apps'"

# Permitir que sólo este repositorio use la cuenta de servicio
gcloud iam service-accounts add-iam-policy-binding $CUENTA \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$NUMERO/locations/global/workloadIdentityPools/github/attribute.repository/zonalta/Apps"

# Valor que hay que copiar a GitHub
echo "projects/$NUMERO/locations/global/workloadIdentityPools/github/providers/github-oidc"
```

Después, en **GitHub → Settings → Secrets and variables → Actions**:

| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `GCP_PROJECT_ID` | el ID del proyecto |
| Variable | `GCP_REGION` | `europe-southwest1` |
| Secret | `GCP_WIF_PROVIDER` | la línea `projects/…/providers/github-oidc` que imprime el script |
| Secret | `GCP_SERVICE_ACCOUNT` | `despliegue-github@TU_PROJECT_ID.iam.gserviceaccount.com` |

El workflow escucha a `main`. Mientras el trabajo siga en la rama
`claude/multidevice-cloud-run-app-vgxe1a`, se lanza a mano desde la pestaña
**Actions → Desplegar en Cloud Run → Run workflow**.

## Qué se despliega

`Dockerfile` en dos etapas: la primera ejecuta `node build.js` y genera
`dist/index.html`; la segunda se queda sólo con el servidor y ese `dist`, y
corre como usuario `node`, sin privilegios.

`server.js` no tiene dependencias. Sirve la aplicación con una política de
contenido que bloquea cualquier recurso externo —la página es autocontenida, así
que si algún día se colara una referencia de fuera, el navegador la pararía—,
expone `/_salud` para las comprobaciones y responde con la aplicación a
cualquier ruta desconocida.
