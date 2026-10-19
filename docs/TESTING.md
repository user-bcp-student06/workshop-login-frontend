# Pruebas de login y tareas

Fecha: 2026-10-19. Alcance exclusivo: `workshop-login-frontend/`.

Suite local Vitest en entorno Node y comprobación DOM adicional en navegador integrado, usando Angular en `http://localhost:4300/` y APIs interceptadas con Playwright. No se contactaron backends. Credenciales, tokens y respuestas son ficticios. En la iteración aprobada de H-08/H-09 se modificaron solo sus componentes, plantilla de dashboard y specs/documentos previstos; no cambiaron contratos HTTP, dependencias, configuración de cobertura ni quality gates.

## Resultado actual de H-08 y H-09

- H-08: cinco pruebas rojas ordinarias confirmaron aceptación de tokens mal tipados y sobrescritura de sesión; después de la guarda de tipo pasan 36/36 pruebas enfocadas de login/autenticación.
- H-09: seis pruebas rojas ordinarias confirmaron excepciones/fallback incorrecto; después de la normalización compartida y el caso de tarea numérica pasan 40/40 pruebas enfocadas de dashboard/tareas.
- Suite completa final: 79/79 pruebas ordinarias, sin it.fails, skip ni todo; código de salida 0.
- Cobertura global: 87.93% de líneas/sentencias, 95% de ramas y 90.9% de funciones. Login y dashboard: 100% de líneas; ramas 100% y 95%, respectivamente. Supera el 85% requerido sin exclusiones nuevas.
- Build Angular: código de salida 0. DOM de H-09 y login válido/logout: verificados con respuestas locales simuladas.
- Prueba visual del mensaje de rechazo H-08: falló por la desactualización de la vista T06. El componente sí rechazó el token y terminó con busy=false y mensaje genérico; no se afirma que la UI de error completa esté corregida.

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
| Login | Token truthy numérico, booleano, objeto o array y sesión previa | Regresión H-08 / BUG-T01 | Rechaza sin crear/sobrescribir sesión, persistir preferencias ni navegar. Mensaje genérico y busy=false comprobados en el componente; limitación DOM T06 separada. Pruebas ordinarias aprobadas. |
| Tareas | Status numérico, booleano, objeto, array, null o ausente | Regresión H-09 / BUG-T02 | Sin excepción: etiqueta vacía, valor CSS vacío y clase pill-. Strings válidos/desconocidos conservan salida. Pruebas ordinarias y DOM local aprobados. |

Los mensajes exactos de error son:

- Login: «No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.»
- Tareas: «No se pudieron cargar las tareas. Intenta de nuevo.»

## Código de los tests

Código completo ejecutado, con setup y parametrizaciones, en estos archivos del repositorio (no son pruebas propuestas):

- [login.component.spec.ts](../src/app/login/login.component.spec.ts): 31 casos de login, errores y regresiones H-08.
- [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts): 34 casos de tareas, sesión, errores y regresiones H-09.
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

### Regresiones ordinarias de las correcciones

Se retiraron ambos it.fails antes de modificar producción y se observaron fallos reales. Las mismas expectativas seguras pasan después del cambio, sin ocultar fallos ni aceptar datos inseguros. Extractos actuales:

```ts
it.each([
  { token: 123 as unknown }, { token: true as unknown },
  { token: {} as unknown }, { token: [] as unknown }
])('BUG-T01: rejects a truthy non-string token: $token', async ({ token }) => {
  vi.mocked(auth.login).mockResolvedValue({ token } as never);
  const component = new LoginComponent(router, session, auth);
  component.username = 'student';
  component.password = 'invalid';

  await component.login();

  expect(session.getToken()).toBeNull();
  expect(session.getUser()).toBeNull();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(router.navigate).not.toHaveBeenCalled();
  expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
  expect(component.busy).toBe(false);
});

it.each([
  { status: 123 as unknown }, { status: true as unknown },
  { status: {} as unknown }, { status: [] as unknown },
  { status: null as unknown }, { status: undefined as unknown }
])('BUG-T02: handles non-string status $status with an empty label', ({ status }) => {
  const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

  expect(() => component.statusLabel(status)).not.toThrow();
  expect(component.statusLabel(status)).toBe('');
  expect(component.statusValue(status)).toBe('');
  expect('pill-' + component.statusValue(status).toLowerCase()).toBe('pill-');
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
| `npm test -- src/app/login/login.component.spec.ts src/app/services/auth.service.spec.ts`, H-08 rojo, 17:11:13 | 1 | 5 fallidos, 31 aprobados de 36; 1.70 s. |
| Mismo comando, H-08 verde, 17:11:38 | 0 | 36/36 aprobados; 1.77 s. |
| `npm test -- src/app/dashboard/dashboard.component.spec.ts src/app/services/tasks.service.spec.ts`, H-09 rojo, 17:12:04 | 1 | 6 fallidos, 33 aprobados de 39; 1.67 s. |
| Mismo comando, H-09 verde y caso adicional, 17:12:31 | 0 | 40/40 aprobados; 1.45 s. |
| `npm test`, 17:12:43 | 0 | 5 archivos, 79/79 pruebas ordinarias; 2.45 s. |
| `npm run test:coverage`, 17:12:47 | 0 | 79/79, 3.38 s; cobertura global de líneas 87.93%. |
| `npm run build`, finalización 22:13:51 UTC | 0 | Bundle Angular generado; 26.457 s. |
| `npm test`, mocks tipados, 17:16:57 | 0 | 79/79 pruebas ordinarias; 2.41 s. Sin cambios de producción desde build/cobertura. |
| `npx tsc --noEmit --experimentalDecorators --moduleResolution bundler --module ES2022 --target ES2022 --skipLibCheck src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` | 0 | Sin errores de tipos en los dos specs afectados. Comprobación directa sin modificar configuración. |

Los mocks de los specs usan `vi.fn<AuthService['login']>()` y `vi.fn<TasksService['getTasks']>()`. El editor siguió mostrando diagnósticos del cast anterior de AuthService; no se reprodujeron con el typecheck directo registrado arriba. Esto no equivale a haber limpiado el panel de diagnósticos del editor.

**Interpretación histórica:** el total previo de 69 incluía 67 pruebas ordinarias y 2 it.fails, que no demostraban corrección. **Resultado final actual:** 79 pruebas ordinarias, sin expectativas de fallo ni tests omitidos. No equivale a validar backends reales; la comprobación DOM ejecutada se detalla por separado.

```text
Test Files  5 passed (5)
    Tests  79 passed (79)
```

| Código medido | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| Global | 87.93% | 95% | 90.9% | 87.93% |
| LoginComponent | 100% | 100% | 100% | 100% |
| DashboardComponent | 100% | 95% | 100% | 100% |
| AuthService, TasksService y SessionService | 100% | 100% | 100% | 100% |
| legacy-format | 100% | 100% | 100% | 100% |

Se supera la meta del 85% de REGLAS.md sin cambiar exclusiones ni umbrales. La cobertura de specs no se cuenta como código de aplicación. Bootstrap, componente raíz y rutas siguen sin cubrirse; no se alteraron. Artefactos generados por la configuración existente: `coverage/coverage-summary.json` y `coverage/index.html`.

## Comprobación DOM local ejecutada

Comando del servidor desde el directorio anterior: `npm start -- --port 4300`. Angular arrancó correctamente en localhost:4300. Proceso de desarrollo persistente, no comando de pruebas con código de salida. Todas las llamadas a `http://localhost:8080/**` y `http://localhost:8000/**` se interceptaron con `page.route` y `route.fulfill` en Playwright; no se enviaron a backends.

| Comprobación | Resultado real |
|---|---|
| Primer intento de automatización | Herramienta devolvió Page not found; se reabrió la página y se confirmó acceso antes de ejecutar aserciones. No fue una prueba de aplicación. |
| Login con token numérico simulado | La espera del mensaje visible agotó 10000 ms. Inspección de la instancia Angular: busy=false y mensaje genérico; DOM todavía con «Ingresando...» y sin nodo de mensaje. Fallo visual T06, no marcado como aprobado. |
| Login válido simulado → dashboard | Navegación correcta con token ficticio y usuario student. |
| Ocho tarjetas: status 123, true, objeto, array, null, ausente, TODO y CUSTOM | Las seis primeras tienen texto de estado vacío y clases `pill pill-`; TODO conserva «Por hacer»/`pill-todo`; CUSTOM conserva «CUSTOM»/`pill-custom`. Aserciones DOM aprobadas. |
| Logout | Navega a login; sin errores de página capturados durante la comprobación exitosa de dashboard/logout. |

La prueba H-09 verificó `article.task`, título, texto del `.pill` y su className en el navegador, no solo los métodos de la clase. La prueba de rechazo de login se reporta fallida aunque sus regresiones unitarias aprueben. No se forzó detectChanges manualmente para aparentar un éxito visual.

## Fallos y riesgos separados

- **Fallos de la ejecución inicial:** dos fixtures mal estructurados; se corrigió el montaje de los datos, no la expectativa. Se reejecutó la misma suite antes de continuar.
- **Regresión BUG-T01 / H-08:** guarda de tipo aplicada; cinco casos ordinarios reproducidos en rojo y después aprobados. El cierre se limita al rechazo del token mal tipado, no a la actualización visual de errores T06 ni a la validación criptográfica de un JWT.
- **Regresión BUG-T02 / H-09:** normalización compartida aplicada; casos ordinarios aprobados y bindings verificados en DOM con datos mal tipados.
- **T03, riesgo observado, no corregido:** si falla el almacenamiento de preferencias o la navegación tras autenticar, la UI muestra fallo pero la sesión ya se guardó y no se revierte. Los tests de error comprueban mensaje y busy, no convierten la sesión residual en un resultado deseable. Fuente: orden de setSession/savePreferences/navigate en LoginComponent.
- **T04, riesgo del orden existente:** el comparador de prioridad es textual y retorna 1 incluso con prioridades iguales. La escala semántica del backend sigue abierta en ENDPOINTS.md. Se conservó la prueba previa, sin añadir una expectativa que lo presente como un orden semántico correcto.
- **T05, límite de validación:** los tipos no validan esquema; campos ausentes/mal tipados pueden pasar sin excepción y generar UI incompleta. Los casos que sí lanzan al procesar ya están probados. No se inventó una política de rechazo que no existe.
- **T06, defecto visual observado, no corregido:** tras respuesta de login con token numérico interceptada en el navegador, el componente tiene busy=false y mensaje genérico, pero la plantilla mantiene el botón deshabilitado «Ingresando...» y no muestra el mensaje. Evidencia: aserción DOM agotada e inspección de la instancia Angular descritas arriba. Hipótesis: actualización asíncrona fuera del mecanismo de detección de cambios; la causa no se confirmó. No se amplió H-08 para cambiar el mecanismo de renderizado sin aprobación.

Correspondencia con el backlog: BUG-T01 corresponde a H-08 y BUG-T02 a H-09 en [HALLAZGOS.md](../HALLAZGOS.md). Esa matriz es el único lugar de seguimiento de su estado. T03–T06 son observaciones fuera del alcance aprobado; no se incorporaron automáticamente como nuevos items.

## Pendientes

- Evaluar y autorizar un item independiente para la actualización visual de errores de login (T06). Las regresiones H-08/H-09 ya son tests ordinarios sin it.fails.
- Decidir tratamiento de sesión residual (T03), validación de esquema (T05) y semántica de prioridad (T04) antes de modificar comportamiento.
- Ampliar las comprobaciones DOM a 401, timeout y otros errores de login: el caso de rechazo por tipo de token ya evidenció T06. El renderizado de estados de tareas y login válido/logout sí se verificaron con respuestas simuladas.
- Confirmar con los propietarios externos el esquema garantizado, códigos de estado y autorización de owner. No se leyeron otros componentes ni se hicieron peticiones reales.

## Pruebas propuestas, no ejecutadas

- En navegador local con servicios ficticios: añadir 401/timeout, mensajes y placeholders. No confundir esta propuesta con el recorrido de login válido, tareas mal tipadas y logout ya ejecutado.
- Con transporte HTTP local controlado: comprobar aborto real del adaptador Axios a 5000 ms y respuestas 401/403. Los tests ejecutados verifican la configuración y simulan el rechazo, no el adaptador de red.
- Con backend autorizado y datos de laboratorio: comprobar validación/expiración de tokens, CORS real y aislamiento por owner. Requiere coordinación externa sin ampliar el alcance de este repositorio.

No se ejecutó auditoría de dependencias en esta iteración. El build sí se ejecutó tras H-08/H-09, con código de salida 0, como consta arriba.

## Documentos y código consultados

- [ENDPOINTS.md](ENDPOINTS.md): flujos, mensajes y límites actuales del cliente.
- [REGLAS.md](../REGLAS.md): cobertura mínima del 85%, no ocultar alertas ni rebajar gates.
- [vitest.config.ts](../vitest.config.ts): entorno Node, inclusión de specs y cobertura V8.
- Specs enlazados arriba: pruebas previas, dobles y ampliaciones ejecutadas.
- [login.component.ts](../src/app/login/login.component.ts), [dashboard.component.ts](../src/app/dashboard/dashboard.component.ts) y [dashboard.component.html](../src/app/dashboard/dashboard.component.html): implementación de H-08/H-09.
- [PLAN.md](../PLAN.md) y [GOOD_PRACTICES.md](GOOD_PRACTICES.md): alcance aprobado y convenciones respetadas.