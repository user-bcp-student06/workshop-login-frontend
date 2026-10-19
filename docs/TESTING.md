# Pruebas de login y tareas

Fecha: 2026-10-19. Alcance exclusivo: `workshop-login-frontend/`.

Pruebas locales Vitest en entorno Node. Se ejercitan componentes como clases, servicios, sesión y estados usados por las plantillas; no se monta un DOM ni se contactan backends. Credenciales, tokens y respuestas son ficticios. No se cambiaron fuentes de producción, contratos HTTP, dependencias, configuración de cobertura ni quality gates en esta tarea.

## Matriz de pruebas

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login → tareas → logout | Credenciales válidas, servicios reales y Axios simulado | Camino feliz | Navega al dashboard, envía bearer y owner, carga la tarea con etiqueta, logout limpia sesión y navega al login; preferencias persisten. |
| Login | Request de autenticación | Camino feliz | POST `/auth/login`, body username/password/client y timeout 5000 ms exactos; devuelve response.data. |
| Tareas | Request autenticado | Camino feliz | GET `/api/tasks?owner=student`, bearer exacto, respuesta como array directo. |
| Login | Usuario/contraseña vacíos y campos con solo espacios | Borde | Mensaje específico, sin petición ni navegación. |
| Login | Token ausente, vacío, null o false | Borde | «El backend respondió sin token.», sin crear sesión ni navegar; busy termina en false. |
| Login | Token presente sin user | Borde | Usa usuario vacío y navega al dashboard, conforme al fallback documentado. |
| Login | Preferencias parciales o JSON corrupto | Borde | Combina preferencias parciales con defaults; JSON corrupto conserva defaults. |
| Login | Backend caído / ERR_NETWORK | Error | Mensaje genérico de autenticación, busy=false, sin navegación ni reintento. |
| Login | CORS simulado como rechazo ERR_NETWORK | Error | Mismo mensaje genérico, no expone detalles. No verifica políticas CORS del navegador. |
| Login | Rechazos 401, 403 y 500 | Error | Mensaje genérico, sin nueva sesión ni navegación. |
| Login | Timeout simulado ECONNABORTED | Error | Libera busy, muestra mensaje genérico, sin reintento. |
| Login | Petición pendiente hasta timeout simulado de 5000 ms | Error | Busy sigue true a 4999 ms y termina false tras el rechazo a 5000 ms. El test de servicio comprueba además la configuración real de 5000 ms. |
| Login | Respuesta null/undefined | Error | Mensaje genérico y busy=false, sin navegar. |
| Login | Error interno o contenido parecido a HTML en backend/username | Error | No expone ese contenido; mensaje genérico seguro para interpolación. |
| Login | Error al persistir preferencias / navegación rechazada | Error | Mensaje genérico y busy=false. La falta de rollback se reporta por separado, no se convierte en expectativa de seguridad. |
| Tareas | Sesión ausente, incluida nueva instancia tras recarga | Borde | Sin token no consulta y redirige al login; una nueva instancia de SessionService no restaura el token. |
| Tareas | Owner vacío y con caracteres especiales | Borde | Query siempre presente y encodeURIComponent aplicado; no configura body ni timeout. |
| Tareas | Array vacío o solo ARCHIVED | Borde | Sin error, visibleTasks vacío y loading=false; estado que habilita el mensaje de lista vacía de la plantilla. |
| Tareas | Filtrado y etiquetado existentes | Camino feliz | Excluye ARCHIVED y produce etiqueta prioridad/owner. El test legacy también documenta orden lexicográfico, no semántico; véase riesgo T04. |
| Tareas | Estados conocidos, desconocido y vacío | Borde | Etiquetas según el mapa documentado y fallback al texto original. |
| Tareas | Token inválido/expirado, rechazos 401/403 | Error | Error genérico, loading=false, sin tareas, sin redirección ni reintento automático. No se prueba validez criptográfica de tokens. |
| Tareas | Estados 404/500 | Error | Mismo error genérico, sin mostrar cuerpo ni lista. |
| Tareas | Backend caído / CORS simulado / cancelación | Error | Error genérico, sin detalles ni reintento, loading=false. |
| Tareas | Timeout de capa externa | Error | Rechazo ECONNABORTED muestra error genérico y termina loading. No se inventa timeout propio del servicio. |
| Tareas | Servidor sin responder | Error | Tras 60000 ms virtuales sin resolver sigue loading=true; al resolver la promesa termina loading. |
| Tareas | Respuesta null, undefined, string, objeto contenedor o array con null | Error | Procesamiento falla dentro del try, mensaje genérico, visibleTasks vacío y loading=false. |
| Servicios | Rechazos red, timeout y 401 | Error | Propagan el rechazo al componente y realizan una única llamada HTTP. |
| Login | Token truthy de tipo numérico | Error conocido BUG-T01 | Expectativa segura: rechazarlo sin crear sesión ni navegar. Actualmente FALLA; registrado con it.fails, no corregido. |
| Tareas | Status numérico en presentación | Error conocido BUG-T02 | Expectativa segura: no lanzar excepción al presentar un estado inválido. Actualmente FALLA; registrado con it.fails, no corregido. |

Los mensajes exactos de error son:

- Login: «No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.»
- Tareas: «No se pudieron cargar las tareas. Intenta de nuevo.»

## Código de los tests

Código completo ejecutado, con setup y parametrizaciones, en estos archivos del repositorio (no son pruebas propuestas):

- [login.component.spec.ts](../src/app/login/login.component.spec.ts): 27 casos de login, errores y BUG-T01.
- [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts): 28 casos de tareas, sesión, errores y BUG-T02.
- [auth.service.spec.ts](../src/app/services/auth.service.spec.ts): 5 casos, incluido el recorrido combinado con ambos servicios y SessionService reales.
- [tasks.service.spec.ts](../src/app/services/tasks.service.spec.ts): 6 casos de contrato y errores.
- [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts): 3 casos previos de etiquetas/fallbacks, sin modificaciones en esta tarea.

Los siguientes extractos son código real de esas suites. Los dobles se resetean entre casos; almacenamiento global y temporizadores se restauran al terminar.

### Timeout del login

En el spec del componente, AuthService es un doble. El reloj controla cuándo rechaza esa promesa; esto no mide la red ni prueba el temporizador interno de Axios.

```ts
it('keeps busy until the simulated 5000 ms timeout and then releases it', async () => {
  vi.useFakeTimers();
  vi.mocked(auth.login).mockImplementation(() => new Promise((_resolve, reject) => {
    setTimeout(() => reject({ code: 'ECONNABORTED' }), 5000);
  }));
  const component = new LoginComponent(router, session, auth);
  component.username = 'student';
  component.password = 'invalid';

  const pending = component.login();
  expect(component.busy).toBe(true);
  await vi.advanceTimersByTimeAsync(4999);
  expect(component.busy).toBe(true);
  await vi.advanceTimersByTimeAsync(1);
  await pending;

  expect(component.busy).toBe(false);
  expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
});
```

### Token inválido, backend caído y otros rechazos de tareas

```ts
it.each([
  ['token invalido 401', { response: { status: 401 } }],
  ['token expirado 403', { response: { status: 403 } }],
  ['500', { response: { status: 500 } }],
  ['404', { response: { status: 404 } }],
  ['backend caido', { code: 'ERR_NETWORK' }],
  ['CORS', { code: 'ERR_NETWORK', message: 'private CORS detail' }],
  ['cancelacion', { code: 'ERR_CANCELED' }],
  ['timeout externo', { code: 'ECONNABORTED' }]
])('reports %s with no automatic redirect or retry', async (_name, error) => {
  session.setSession('fake-token', { username: 'student' });
  vi.mocked(tasksService.getTasks).mockRejectedValue(error);
  const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

  await component.ngOnInit();

  expect(component.error).toBe('No se pudieron cargar las tareas. Intenta de nuevo.');
  expect(component.loading).toBe(false);
  expect(component.visibleTasks).toEqual([]);
  expect(router.navigate).not.toHaveBeenCalled();
  expect(tasksService.getTasks).toHaveBeenCalledTimes(1);
});
```

### Query de tareas

```ts
it.each(['', 'student & trainer'])('encodes owner %j and does not configure a timeout or body', async (owner) => {
  vi.mocked(axios.get).mockResolvedValue({ data: [] });

  await new TasksService().getTasks(owner, 'fake-token');

  expect(axios.get).toHaveBeenCalledExactlyOnceWith(
    `http://localhost:8000/api/tasks?owner=${encodeURIComponent(owner)}`,
    { headers: { Authorization: 'Bearer fake-token' } }
  );
});
```

### Regresiones de bugs, no correcciones

No se cambió la expectativa para aceptar datos inseguros. Se usa `it.fails` para señalar que la aserción segura debe fallar en producción actual; si deja de fallar, Vitest exigirá revisar ese marcador. No son tests omitidos y sus defectos siguen abiertos.

```ts
it.fails('BUG-T01: rejects a truthy non-string token instead of creating a session', async () => {
  vi.mocked(auth.login).mockResolvedValue({ token: 123 } as never);
  const component = new LoginComponent(router, session, auth);
  component.username = 'student';
  component.password = 'invalid';

  await component.login();

  expect(session.getToken()).toBeNull();
  expect(router.navigate).not.toHaveBeenCalled();
});

it.fails('BUG-T02: handles a non-string status without a rendering exception', () => {
  const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

  expect(() => component.statusLabel(123 as unknown as string)).not.toThrow();
});
```

## Ejecuciones reales

Directorio de trabajo de todos los comandos: `C:/Users/Usuario/Documents/T53152-rosemary-saravia/reqflow-workspace/workshop-login-frontend`. Runner: Vitest 3.2.4. Fecha: 2026-10-19.

| Comando / momento | Código de salida | Resultado observado |
|---|---|---|
| `npm test` antes de editar, 16:49:50 | 0 | 5 archivos, 17 casos aprobados; 13.86 s. |
| `npm test` primera ampliación, 16:50:56 | 1 | 58 aprobados y 2 fallidos de 60. Error de fixtures it.each: arrays expandidos como argumentos. |
| `npm test` fixtures corregidos, 16:51:12 | 0 | 5 archivos, 60 casos contados como aprobados; 3.26 s. |
| `npm test` final con recorrido combinado, 16:51:47 | 0 | 5 archivos, 69 casos contados como aprobados; 2.33 s. |
| `npm run test:coverage`, 16:52:08 | 0 | 5 archivos, 69 casos; 2.87 s. Cobertura V8 detallada abajo. |

**Interpretación del total final:** 67 pruebas ordinarias aprobadas y 2 expectativas de fallo (`it.fails`) reproducidas. Vitest imprime `69 passed`, pero esto NO significa que BUG-T01 y BUG-T02 estén corregidos. No hay tests skip/todo añadidos. Tampoco significa que el backend o el DOM real se hayan validado.

```text
Test Files  5 passed (5)
     Tests  69 passed (69)
```

| Código medido | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| Global | 87.44% | 94.73% | 90.47% | 87.44% |
| LoginComponent | 100% | 100% | 100% | 100% |
| DashboardComponent | 100% | 94.44% | 100% | 100% |
| AuthService, TasksService y SessionService | 100% | 100% | 100% | 100% |
| legacy-format | 100% | 100% | 100% | 100% |

Se supera la meta del 85% de REGLAS.md sin cambiar exclusiones ni umbrales. Solo se modificaron specs; su cobertura no se cuenta como código de aplicación. Bootstrap, componente raíz y rutas siguen sin cubrirse; no se alteraron. Artefactos generados por la configuración existente: `coverage/coverage-summary.json` y `coverage/index.html`.

## Fallos y riesgos separados

- **Fallos de la ejecución inicial:** dos fixtures mal estructurados; se corrigió el montaje de los datos, no la expectativa. Se reejecutó la misma suite antes de continuar.
- **BUG-T01, reproducido:** el login acepta un token numérico truthy y crea sesión/navega porque solo evalúa `response.token`. Evidencia: `src/app/login/login.component.ts`, comprobación del token y llamada a setSession; regresión `it.fails` en su spec. Pendiente validación de estructura; no se afirma que la UI pueda validar la firma de un JWT.
- **BUG-T02, reproducido:** statusLabel(123) lanza TypeError por toUpperCase; la plantilla también aplica toLowerCase al status. Evidencia: `src/app/dashboard/dashboard.component.ts`, método statusLabel, y `src/app/dashboard/dashboard.component.html`; regresión `it.fails` en el spec. Se prueba el fallo del método directamente, no se afirma haber montado la plantilla.
- **T03, riesgo observado, no corregido:** si falla el almacenamiento de preferencias o la navegación tras autenticar, la UI muestra fallo pero la sesión ya se guardó y no se revierte. Los tests de error comprueban mensaje y busy, no convierten la sesión residual en un resultado deseable. Fuente: orden de setSession/savePreferences/navigate en LoginComponent.
- **T04, riesgo del orden existente:** el comparador de prioridad es textual y retorna 1 incluso con prioridades iguales. La escala semántica del backend sigue abierta en ENDPOINTS.md. Se conservó la prueba previa, sin añadir una expectativa que lo presente como un orden semántico correcto.
- **T05, límite de validación:** los tipos no validan esquema; campos ausentes/mal tipados pueden pasar sin excepción y generar UI incompleta. Los casos que sí lanzan al procesar ya están probados. No se inventó una política de rechazo que no existe.

Estos identificadores T/BUG-T son referencias locales del informe, no estados nuevos ni resoluciones en HALLAZGOS.md. No se cambió esa matriz.

## Pendientes

- Corregir BUG-T01/BUG-T02 y retirar it.fails al implementar la expectativa segura, con aprobación del cambio de producción.
- Decidir tratamiento de sesión residual (T03), validación de esquema (T05) y semántica de prioridad (T04) antes de modificar comportamiento.
- Comprobar renderizado real (mensajes, placeholders, botones y errores tardíos de plantilla) y navegación Angular en navegador: las pruebas actuales instancian clases, con router, zona y detector simulados.
- Confirmar con los propietarios externos el esquema garantizado, códigos de estado y autorización de owner. No se leyeron otros componentes ni se hicieron peticiones reales.

## Pruebas propuestas, no ejecutadas

- En navegador local con servicios ficticios: inspeccionar DOM tras login correcto, 401, timeout, respuestas mal tipadas y logout; verificar contenido textual, visibilidad y ausencia de HTML ejecutable.
- Con transporte HTTP local controlado: comprobar aborto real del adaptador Axios a 5000 ms y respuestas 401/403. Los tests ejecutados verifican la configuración y simulan el rechazo, no el adaptador de red.
- Con backend autorizado y datos de laboratorio: comprobar validación/expiración de tokens, CORS real y aislamiento por owner. Requiere coordinación externa sin ampliar el alcance de este repositorio.

No se ejecutaron auditoría de dependencias ni build en esta tarea; no se atribuyen aquí nuevos resultados a esos comandos.

## Documentos y código consultados

- [ENDPOINTS.md](ENDPOINTS.md): flujos, mensajes y límites actuales del cliente.
- [REGLAS.md](../REGLAS.md): cobertura mínima del 85%, no ocultar alertas ni rebajar gates.
- [vitest.config.ts](../vitest.config.ts): entorno Node, inclusión de specs y cobertura V8.
- Specs enlazados arriba: pruebas previas, dobles y ampliaciones ejecutadas.
- [login.component.ts](../src/app/login/login.component.ts) y [dashboard.component.ts](../src/app/dashboard/dashboard.component.ts): caminos de control, mensajes y defectos identificados. No se editaron.