# Endpoints externos consumidos

Contrato observado desde el frontend actual, no una especificación verificada del backend. No se hicieron peticiones a los servicios ni se revisaron otros componentes del workspace. Los ejemplos reproducen valores ficticios presentes en los tests; no son respuestas capturadas ni tokens válidos.

Las bases están en `src/environments/environment.ts`. Los servicios devuelven `response.data`, sin inspeccionar el estado concreto. Axios acepta por defecto estados 200–299. Los tipos TypeScript no validan los datos en ejecución.

## Login: POST /auth/login

### 1. Quién lo llama

El botón «Ingresar» ejecuta `LoginComponent.login()`, que valida campos y delega HTTP a `AuthService.login(request)`.

Fuentes: `src/app/login/login.component.ts`, `src/app/login/login.component.html` y `src/app/services/auth.service.ts`.

### 2. Qué envía

URL actual: `POST http://localhost:8080/auth/login`. No envía query params. El timeout es **5000 ms**, definido en `AuthService`.

| Ubicación | Campo | Valor / regla |
|---|---|---|
| Header | `Content-Type` | `application/json`, establecido por Axios al serializar el objeto del body. |
| Header | `Accept` | `application/json, text/plain, */*`, predeterminado de Axios. |
| Header | `Authorization` | El servicio no lo establece; no adjunta el token de sesión. |
| Body JSON | `username` | String introducido; no puede estar vacío ni contener solo espacios. |
| Body JSON | `password` | String introducido; no puede estar vacío ni contener solo espacios. |
| Body JSON | `client` | Literal `angular-workshop`. |

`trim()` solo comprueba vacío: se envían los valores originales, sin recortarlos. No se envían preferencias. No se configura `withCredentials` ni un flujo de autenticación por cookie. Headers adicionales del navegador, como `Origin`, no se fijan desde el servicio.

Ejemplo de petición con los valores de `src/app/services/auth.service.spec.ts`:

```http
POST /auth/login HTTP/1.1
Host: localhost:8080
Accept: application/json, text/plain, */*
Content-Type: application/json

{"username":"student","password":"Workshop123!","client":"angular-workshop"}
```

Fuentes: `src/app/models/auth.model.ts`, `src/app/services/auth.service.ts` y los valores predeterminados de `node_modules/axios/lib/defaults/index.js`.

### 3. Qué espera recibir en éxito

**Estado HTTP:** cualquier 2xx aceptado por Axios. No se exige específicamente `200`; el código exacto del backend es una pregunta abierta. Un 2xx no basta: el componente exige un `token` truthy; un `204` sin cuerpo no proporciona ese token.

| Campo JSON | Tipo declarado | Uso en el cliente |
|---|---|---|
| `token` | `string`, opcional en la interfaz | Necesario en la práctica para continuar: debe ser un string truthy. Se rechazan valores truthy de otro tipo antes de crear sesión. No se comprueban formato, firma ni expiración; no se recorta el contenido. |
| `user` | `SessionUser`, opcional | Usuario de sesión en memoria. Si falta o es falsy, se usa `{}`. |
| `user.username` | `string`, opcional | Query `owner` de tareas y nombre alternativo para el saludo. |
| `user.displayName` | `string`, opcional | Nombre preferido para el saludo del dashboard. |
| Otras propiedades de `user` | `unknown` | La interfaz las admite; el flujo observado no les asigna significado. |

Ejemplo de cuerpo de éxito reproducido del test de `AuthService` (token ficticio):

```json
{
	"token": "fake-token",
	"user": { "username": "student", "displayName": "Student" }
}
```

Con ese cuerpo se guarda token/usuario en memoria mediante `SessionService`, se persisten preferencias como `workshop_preferences` y se navega a `/dashboard`. Se muestra «Hola, Student» y se consulta tareas con `owner=student`. No se persisten token ni usuario en almacenamiento web.

Fuentes: `src/app/models/auth.model.ts`, `src/app/services/session.service.ts`, `src/app/login/login.component.ts` y `src/app/dashboard/dashboard.component.html`.

### 4. Cómo reacciona ante errores

Durante la petición, `busy=true`: el botón se deshabilita y muestra «Ingresando...». El bloque `finally` restablece el estado del componente a `busy=false` al terminar, incluso si hay error. Limitación visual observada con respuesta local simulada: ante token numérico el componente termina con busy=false y mensaje genérico, pero la vista puede seguir mostrando «Ingresando...» sin mensaje hasta una nueva detección de cambios. Véase T06 en `docs/TESTING.md`; no se corrigió en H-08.

| Caso | Reacción de UI y sesión |
|---|---|
| Usuario vacío o solo espacios | «Ingrese un usuario.»; no hace HTTP ni navega. |
| Contraseña vacía o solo espacios | «Ingrese una contraseña.»; no hace HTTP ni navega. |
| Credenciales rechazadas, 401/403 u otro estado rechazado por Axios | «No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.»; no navega al dashboard por este camino. No distingue estados. |
| Timeout de 5000 ms | El mismo mensaje genérico; libera el botón, sin reintento automático. |
| Red, CORS, servicio caído u otro rechazo de la promesa | El mismo mensaje; no muestra el cuerpo ni el detalle interno del error. |
| Objeto de respuesta sin `token`, vacío o falsy | «El backend respondió sin token.»; no crea una nueva sesión ni navega al dashboard. |
| Cuerpo nulo/indefinido u otra estructura que lanza al acceder a `token` | Se captura la excepción y se muestra el mensaje genérico. No hay validación de esquema. |
| Token truthy de tipo incorrecto (número, booleano, objeto o array) | Se rechaza antes de crear/reemplazar sesión, persistir preferencias o navegar. El componente establece el mensaje genérico y busy=false; la actualización inmediata del DOM tiene la limitación T06 descrita arriba. |
| Token string truthy pero inválido o expirado | No se verifica su validez: guarda el valor sin modificarlo y navega al dashboard. Si tareas lo rechaza, se aplica el comportamiento del endpoint siguiente. |
| `user` ausente | No es un error para el cliente: usa `{}`; luego consulta con `owner=` y el saludo puede carecer de nombre. |
| Error al guardar preferencias o rechazo de navegación tras guardar sesión | Se muestra el mensaje genérico. No se revierte la sesión ya guardada en memoria. |

El error no limpia una sesión previa. No hay refresco de token, validación de JWT ni reintento automático.

Preguntas abiertas: ¿qué estado exacto y cuerpo de error devuelve el backend?, ¿garantiza un token string y `user.username`?, ¿qué formato/caducidad tiene el token? El cliente no confirma esas garantías.

Fuente del comportamiento: `src/app/login/login.component.ts`; presentación: `src/app/login/login.component.html`.

### 5. Notas de seguridad

- `SessionService` es un singleton raíz: conserva token y usuario solo en memoria. Recargar la SPA pierde la sesión y el dashboard redirige a login.
- Solo persisten preferencias (`theme`, `showTips`, `compact`). Las posibles claves `workshop_token`/`workshop_user` dejadas por la versión legacy no se usan, pero el código actual tampoco las elimina.
- El mensaje usa `{{ message }}`, sin `[innerHTML]` ni bypass del sanitizador. Los mensajes internos del backend ya no se incorporan al texto visible.
- La memoria reduce persistencia, pero un XSS activo en el origen todavía puede actuar como el usuario. No se implementa cookie `HttpOnly`.
- Las URLs usan HTTP local de laboratorio, no TLS. No usar credenciales reales ni exponer la aplicación en Internet.

Fuentes: `src/app/services/session.service.ts`, `src/app/login/login.component.html`, `src/app/login/login.component.ts` y `README.md`.

## Tareas: GET /api/tasks

### 1. Quién lo llama

`DashboardComponent.ngOnInit()` obtiene token y usuario desde `SessionService` y llama a `TasksService.getTasks(owner, token)`. Si no existe token, navega a `/login` y retorna **sin hacer la petición**. Solo comprueba presencia, no validez.

Fuentes: `src/app/dashboard/dashboard.component.ts`, `src/app/services/tasks.service.ts` y `src/app/services/session.service.ts`.

### 2. Qué envía

URL actual: `GET http://localhost:8000/api/tasks?owner=<username>`. No envía body ni configura timeout: el predeterminado de Axios es **0**, sin límite temporal de aplicación. No configura reintentos ni `withCredentials`.

| Ubicación | Campo | Valor / regla |
|---|---|---|
| Header | `Authorization` | `Bearer <token>` usando el valor guardado en memoria. |
| Header | `Accept` | `application/json, text/plain, */*`, predeterminado de Axios. |
| Header | `Content-Type` | El servicio no lo establece para este GET sin cuerpo. |
| Query | `owner` | `user.username` o `''` si falta/es falsy. Se codifica con `encodeURIComponent`. Siempre construye `?owner=`, incluso sin nombre. |
| Body | Ninguno | No envía JSON ni formulario. |

Ejemplo de petición con los valores de `src/app/services/tasks.service.spec.ts`:

```http
GET /api/tasks?owner=student HTTP/1.1
Host: localhost:8000
Accept: application/json, text/plain, */*
Authorization: Bearer fake-token
```

El token es ficticio; no se ha comprobado que el servidor lo acepte. Headers adicionales del navegador no se establecen desde el servicio.

### 3. Qué espera recibir en éxito

**Estado HTTP:** cualquier 2xx aceptado por Axios; no se exige específicamente `200`. Se espera un **array JSON directo**, no `{ "tasks": [...] }`. Un 2xx con cuerpo vacío no equivale a un array vacío.

| Campo de cada tarea | Tipo declarado | Uso en el cliente |
|---|---|---|
| `title` | `string`, requerido | Título de la tarjeta. |
| `description` | `string`, opcional | Texto descriptivo de la tarjeta. |
| `status` | `string`, requerido | Filtrado de archivadas, etiqueta de estado y clase visual. |
| `priority` | `string`, requerido | Etiqueta en mayúsculas y comparación textual descendente para ordenar. |
| `owner` | `string`, opcional | Etiqueta en mayúsculas; si falta/es falsy, se usa `SIN-ASIGNAR`. |
| `label` | `string`, opcional | Admitido por el tipo, pero se recalcula para las tareas visibles; no hace falta enviarlo. |

Ejemplo de cuerpo de éxito reproducido del test de `TasksService`:

```json
[
	{ "title": "First", "status": "TODO", "priority": "high", "owner": "student" }
]
```

La UI muestra «First», etiqueta `HIGH · STUDENT` y estado «Por hacer»; no se incluye descripción en este ejemplo porque el test tampoco la incluye. Para `[]`, o solo tareas archivadas, muestra «No hay tareas para mostrar todavía.».

Se excluye solo `status === 'ARCHIVED'`, sensible a mayúsculas. El resto recibe una etiqueta de prioridad (mayúsculas o `NORMAL` si es falsy) y propietario, separados por ` · `. El orden usa `first.priority > second.priority ? -1 : 1`: es lexicográfico, no una escala semántica de prioridad; para las cadenas `low` y `high` del test, `low` va primero. El comparador no retorna cero para prioridades iguales.

El mapa de estados visibles es: `TODO` → «Por hacer», `IN_PROGRESS` → «En progreso», `DONE` → «Completado», `RESUELTO` → «Resuelto», `COMPLETED` → «Completado». La búsqueda convierte a mayúsculas y conserva el texto original para strings desconocidos. `statusValue(unknown)` devuelve el string original o `''` si no es string, y se reutiliza en la etiqueta y la clase CSS. Los estados no textuales muestran etiqueta vacía y clases `pill pill-`, sin convertir números u objetos a texto. No se infiere que ese mapa sea el enum completo del backend.

Fuentes: `src/app/models/task.model.ts`, `src/app/dashboard/dashboard.component.ts`, `src/app/dashboard/dashboard.component.html`, `src/app/utils/legacy-format.ts` y `src/app/dashboard/dashboard.component.spec.ts`.

### 4. Cómo reacciona ante errores

Mientras la consulta está pendiente, `loading=true` y se muestran placeholders. En éxito se asignan las tareas y `loading=false`; aparecen tarjetas o el mensaje de lista vacía.

| Caso | Reacción de UI y sesión |
|---|---|
| Sin token en memoria, por ejemplo tras recargar | Navega a `/login` sin consultar tareas. |
| Token inválido/expirado y respuesta 401/403 | «No se pudieron cargar las tareas. Intenta de nuevo.»; quita la carga y oculta la lista. No limpia sesión, no refresca token ni redirige a login. |
| Otro estado rechazado por Axios | El mismo mensaje genérico; no usa el cuerpo de error ni distingue 404/500. |
| Red, CORS, cancelación o rechazo por un timeout de una capa externa | El mismo mensaje y `loading=false`, sin reintento automático. |
| Servidor sin responder y promesa aún pendiente | No hay timeout de aplicación: pueden permanecer los placeholders hasta que la red/navegador resuelva o falle. |
| Objeto contenedor, `null` o valor sin `.filter()` | El procesamiento lanza dentro del `try`: muestra el mensaje genérico, sin lista y con `loading=false`. |
| Array con elementos nulos que fallan al acceder a `status` | También termina en el mensaje genérico. |
| Campos ausentes/mal tipados que no lanzan al procesar | No hay validación de esquema: pueden mostrarse valores vacíos, fallbacks u orden inesperado. |
| `status` que no sea string | Se conserva la tarea y se normaliza solo su presentación: etiqueta vacía y clase `pill-`, sin excepción de conversión en esos bindings. No se modifica el filtro ARCHIVED ni se valida el resto del esquema. Verificado en DOM local con respuestas simuladas. |

El botón «Cerrar sesión» llama a `logout()`, limpia token/usuario en memoria y navega a `/login`; conserva preferencias. No llama a un endpoint de logout ni revoca el token en el backend. No hay botón de reintento de tareas en la plantilla: «Intenta de nuevo» no dispara otra petición por sí mismo.

Preguntas abiertas: ¿qué estado exacto y esquema garantiza la API?, ¿qué valores/orden de prioridad son válidos?, ¿cómo autoriza el servidor el filtro `owner`?, ¿qué plazo de respuesta garantiza? Los mocks y el cliente no lo confirman.

Fuentes: `src/app/dashboard/dashboard.component.ts` y `src/app/dashboard/dashboard.component.html`.

### 5. Notas de seguridad

- El bearer procede del servicio de sesión en memoria. La comprobación local es solo de presencia; la validación de firma, caducidad y permisos corresponde al servidor.
- Codificar `owner` evita que sus caracteres alteren la query, pero no demuestra autorización. El filtro es controlado desde el cliente; no se puede afirmar aislamiento entre usuarios sin verificar el backend.
- Los títulos, descripciones, etiquetas y errores se interpolan sin `[innerHTML]` ni bypass del sanitizador. El valor de presentación de `status` se limita a string o vacío antes de construir su clase CSS; esto no es validación general del esquema ni un enum de estados permitidos.
- Los errores ya no exponen `response.data.detail` ni mensajes internos. Un 401 conserva sesión local hasta logout o recarga.
- HTTP local no cifra el bearer con TLS. La sesión en memoria no impide el uso de credenciales por un XSS activo.

Fuentes: `src/app/services/tasks.service.ts`, `src/app/services/session.service.ts`, `src/app/dashboard/dashboard.component.ts`, `src/app/dashboard/dashboard.component.html` y `src/environments/environment.ts`.

## Documentos y código consultados

- `docs/ENDPOINTS.md`: versión anterior contrastada con el código actual.
- `README.md`: contexto local, credenciales ficticias y advertencias del laboratorio; sus menciones a deuda legacy no se tomaron como evidencia actual.
- `src/environments/environment.ts`: bases de los servicios.
- `src/app/services/auth.service.ts`, `src/app/services/tasks.service.ts`, `src/app/services/session.service.ts`: llamadas HTTP, timeout y sesión/preferencias.
- `src/app/models/auth.model.ts`, `src/app/models/task.model.ts`: campos y tipos esperados.
- `src/app/login/login.component.ts`, `src/app/login/login.component.html`: validaciones, mensajes y navegación.
- `src/app/dashboard/dashboard.component.ts`, `src/app/dashboard/dashboard.component.html`, `src/app/utils/legacy-format.ts`: tareas, UI y logout.
- `src/app/services/auth.service.spec.ts`, `src/app/services/tasks.service.spec.ts`, `src/app/dashboard/dashboard.component.spec.ts`: ejemplos ficticios y caracterización local, no respuestas de backend.
- `node_modules/axios/lib/defaults/index.js`: headers, transformación JSON, timeout y estados predeterminados de Axios instalado.