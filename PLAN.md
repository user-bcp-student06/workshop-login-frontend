# Plan de correccion

## Alcance

Seleccion: H-08 y H-09, los dos items actualmente `Pendiente` en
`HALLAZGOS.md`, ambos de severidad media y reproducidos mediante pruebas
`it.fails`. Se eligen por su impacto en el flujo y por disponer de una
regresion concreta. No se reabren H-01 a H-07 ni se incluyen los riesgos
T03 a T05 del informe de testing.

Este documento define el alcance aprobado de implementacion. El estado de
los items se sigue exclusivamente en `HALLAZGOS.md` y solo se actualiza despues
de verificar cada correccion.

## Aprobacion

- Estado: Aprobado
- Aprobado por: Rosemary Saravia
- Fecha: 2026-10-19
- Alcance: H-08 y H-09; autorizacion explicita registrada en esta conversacion.

Se mantienen `POST /auth/login`, su body username/password/client, timeout
de 5000 ms, `GET /api/tasks`, owner codificado y Authorization bearer. No se
agregan endpoints, dependencias ni secretos. Se conserva la sesion en memoria,
logout, el tratamiento de 401/403 y los errores genericos sin detalles internos.
Los unicos cambios de comportamiento propuestos son las correcciones de datos
de tipo incorrecto descritas expresamente por H-08 y H-09; no cambian el esquema
HTTP esperado. Las filas de ENDPOINTS.md que describen esos bugs se actualizaran
solo cuando la implementacion y las pruebas lo confirmen.

## Item: H-08 - Login acepta un token truthy que no sea string

**Item de HALLAZGOS.md:** H-08, BUG-T01 del informe de testing, severidad media.

**Problema y evidencia:** `src/app/login/login.component.ts:50` solo comprueba
si token es truthy y en la linea 55 lo entrega a SessionService. El test
`BUG-T01` en `src/app/login/login.component.spec.ts:250` reproduce que un token
numerico crea sesion. El tipado estatico no valida una respuesta real.

**Cambio propuesto:** Agregar una guarda de tipo antes de setSession y de
cualquier efecto de exito: un token truthy que no sea string se rechaza con el
mensaje generico de autenticacion existente y retorno anticipado. Conservar
la comprobacion y el mensaje actuales para token ausente o falsy; una cadena
no vacia sigue el camino exitoso sin recortar ni modificar su contenido.
No persistir preferencias ni navegar en el nuevo camino de rechazo. No crear
sesion nueva ni reemplazar una previa por un token mal tipado. Mantener el
finally que restablece busy. No validar firma/expiracion JWT desde el cliente,
no cambiar SessionService y no introducir un esquema de validacion general.

**Archivos a tocar durante la implementacion:**

- `src/app/login/login.component.spec.ts`: regresion BUG-T01 y casos de token.
- `src/app/login/login.component.ts`: guarda local con retorno anticipado.
- `docs/ENDPOINTS.md`: actualizar exclusivamente el tratamiento de token de
	tipo incorrecto; mantener formato, payload y campos opcionales documentados.
- `docs/TESTING.md`: registrar la regresion ya corregida y resultados reales.
- `HALLAZGOS.md`: marcar solo H-08 Resuelto con evidencia tras verificarlo.

**Prueba a escribir o activar antes de tocar produccion:** Convertir el
`it.fails` de BUG-T01 en un test normal y ampliarlo con tokens truthy numerico,
booleano, objeto y array, mediante datos ficticios tratados como unknown en el
limite de prueba. Confirmar primero el fallo real de la expectativa segura:
no crear sesion, no guardar preferencias, no navegar, mensaje generico y
busy=false. Agregar un caso con sesion previa para verificar que no se
sobrescribe con datos incorrectos. No adaptar la expectativa al bug.

Mantener regresiones para token string valido, user ausente, respuesta sin
token, token falsy, backend caido y timeout. El exito debe continuar enviando
el mismo bearer al cargar tareas y permitir logout. Un token string ficticio
se acepta sin afirmar que sea criptograficamente valido.

**Verificacion prevista, no ejecutada en esta tarea:**

```sh
npm test -- src/app/login/login.component.spec.ts src/app/services/auth.service.spec.ts
npm test
npm run test:coverage
npm run build
```

**Cierre:** BUG-T01 pasa como prueba ordinaria, sin it.fails ni skip; el nuevo
camino no cambia la peticion HTTP ni el camino feliz. Actualizar resultados
solo despues de ejecutar las comprobaciones. La sesion residual ante errores
de almacenamiento/navegacion (T03) queda fuera de este item.

## Item: H-09 - Estado de tarea no textual provoca excepcion de presentacion

**Item de HALLAZGOS.md:** H-09, BUG-T02 del informe de testing, severidad media.

**Problema y evidencia:** `src/app/dashboard/dashboard.component.ts:40` llama
a toUpperCase sin comprobar tipo; `src/app/dashboard/dashboard.component.html:25`
llama a toLowerCase. El test `BUG-T02` en
`src/app/dashboard/dashboard.component.spec.ts:170` reproduce la excepcion del
metodo con un status numerico; aun no demuestra el renderizado DOM real.

**Cambio propuesto:** Centralizar en una funcion pequena del componente la
normalizacion del valor de presentacion: recibir unknown, devolver el string
original cuando lo sea y cadena vacia en cualquier otro caso. Reutilizarla
tanto en statusLabel como en el binding que construye la clase CSS, evitando
dos guardas duplicadas y llamadas de string sobre datos desconocidos.
No convertir numeros/objetos a texto, inventar nuevos estados ni renderizar HTML.
Usar el comportamiento existente de status vacio como fallback: etiqueta vacia
y la misma clase base usada para ese caso. Conservar las etiquetas de estados
conocidos y el texto de strings desconocidos.

La normalizacion es de presentacion: no modifica la respuesta HTTP, el filtro
exacto ARCHIVED, prioridad, orden ni el resto de campos. No introduce validacion
global de tareas ni cambia las decisiones sobre errores de carga o token.

**Archivos a tocar durante la implementacion:**

- `src/app/dashboard/dashboard.component.spec.ts`: regresion BUG-T02 y pruebas
	de la normalizacion compartida y de estados validos.
- `src/app/dashboard/dashboard.component.ts`: funcion de normalizacion y su
	reutilizacion en statusLabel.
- `src/app/dashboard/dashboard.component.html`: usar la misma normalizacion
	antes de construir la clase CSS, conservando la estructura de la tarjeta.
- `docs/ENDPOINTS.md`: sustituir exclusivamente la nota de excepcion por el
	fallback de presentacion verificado, sin redefinir el contrato de la API.
- `docs/TESTING.md`: registrar regresion, limite de pruebas y resultados reales.
- `HALLAZGOS.md`: marcar solo H-09 Resuelto con evidencia tras verificarlo.

**Prueba a escribir o activar antes de tocar produccion:** Convertir BUG-T02 de
it.fails a test ordinario y confirmar primero que falla con el codigo actual.
Ampliar los casos a numero, booleano, objeto, array, null y undefined. Exigir
que el metodo no lance y use el fallback vacio. Tras introducir la funcion
compartida, probar su salida para los mismos valores y para strings validos;
la plantilla debe consumir esa salida antes de llamar a toLowerCase.

Conservar pruebas de TODO, IN_PROGRESS, DONE, RESUELTO, COMPLETED, string
desconocido y vacio. Agregar un caso de tareas con status numerico que se
procesen sin convertir un error de presentacion en exito ficticio: verificar
por separado estado de carga, etiqueta y valor usado por la clase CSS. Mantener
las regresiones de ARCHIVED, lista vacia, 401 y backend caido.

El entorno Vitest actual es Node sin DOM. Las pruebas de metodo/normalizacion
y la revision del binding no se presentaran como una prueba de renderizado.
Para verificar la plantilla real, usar una comprobacion en navegador local con
Axios/API simulados, sin llamar otros componentes ni instalar dependencias.
Si no se puede ejecutar, registrar esa verificacion visual como pendiente y
no afirmar que el DOM se verifico.

**Verificacion prevista, no ejecutada en esta tarea:**

```sh
npm test -- src/app/dashboard/dashboard.component.spec.ts src/app/services/tasks.service.spec.ts
npm test
npm run test:coverage
npm run build
```

**Cierre:** BUG-T02 pasa como test ordinario; ninguna de las dos conversiones
de texto recibe un valor mal tipado y los strings validos conservan su salida.
Registrar el resultado de navegador o su limitacion por separado. No corregir
el comparador de prioridades (T04) como parte de este item.

## Reglas comunes de ejecucion futura

Ejecutar cada item en una tanda revisable: prueba roja real, cambio minimo,
prueba verde y regresiones. No mezclar la guarda del login con la normalizacion
de tareas en un unico apartado o cierre. No agregar any, dependencias, URLs o
claves de almacenamiento en componentes; mantener HTTP en los servicios,
sesion centralizada, mensajes seguros e interpolacion de texto.

Medir al menos 85% de cobertura del codigo modificado conforme a REGLAS.md,
sin bajar umbrales ni excluir lineas para aparentar cumplimiento. Registrar
comandos, codigos de salida y resultados reales; estos comandos y pruebas se
proponen aqui y no se han ejecutado para una correccion inexistente.

## Fuentes consultadas

- `HALLAZGOS.md`: H-08 y H-09, evidencia y estado actual.
- `docs/ENDPOINTS.md`: peticiones, respuestas y limites del cliente a preservar.
- `docs/GOOD_PRACTICES.md`: tipado, responsabilidades, sesion y errores.
- `src/app/login/login.component.spec.ts`: regresion BUG-T01.
- `src/app/dashboard/dashboard.component.spec.ts`: regresion BUG-T02 y estados.
- `REGLAS.md`: meta de cobertura y cambios incrementales, consultado en el
	trabajo previo del repositorio.
