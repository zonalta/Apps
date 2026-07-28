# Desplegar en Cloud Run

## Antes de empezar: dos aclaraciones

**El nombre del servicio no puede ser «Gestión Electoral».** Cloud Run sólo admite
minúsculas, números y guiones, sin acentos ni espacios. El servicio se llama
**`gestion-electoral`**; «Gestión Electoral» es el nombre de la aplicación y el
que aparece dentro de ella.

**Desplegar da una URL compartida, pero todavía no datos compartidos.** La
aplicación guarda los censos en el navegador (`localStorage`), así que cada
dispositivo mantiene los suyos: lo que cargues en el iPad no aparecerá en el
ordenador del trabajo. Para eso hace falta backend y base de datos, que es el
paso siguiente. Lo que sí resuelve este despliegue es tener **una sola URL, con
la misma versión de la aplicación en todos los dispositivos**, sin depender de
la vista previa.

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
  --memory 256Mi \
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

`--allow-unauthenticated` deja la URL abierta a cualquiera que la conozca. Hoy
eso expone **la aplicación, no los datos**: los censos viven en el navegador de
cada usuario y el servidor no guarda nada ni tiene API.

Si prefieres cerrarla desde el principio, quita esa opción y añade acceso por
usuario:

```bash
gcloud run services remove-iam-policy-binding gestion-electoral \
  --region europe-southwest1 --member=allUsers --role=roles/run.invoker

gcloud run services add-iam-policy-binding gestion-electoral \
  --region europe-southwest1 \
  --member=user:zonalta@gmail.com --role=roles/run.invoker
```

El inconveniente: para abrirla desde el iPad haría falta pasar por
[Cloud Run proxy](https://cloud.google.com/run/docs/authenticating/end-users) o
poner delante un balanceador con IAP, que ya es montaje serio.

**En el momento en que los datos pasen al servidor, cerrar el acceso deja de ser
opcional.** Conviene tenerlo presente al planificar ese paso.

## Coste

El servicio escala a cero: sin visitas, no hay instancias y no se factura. Con
256 MiB, un uso de unas pocas personas cabe de sobra en la
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
