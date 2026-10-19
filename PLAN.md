# Plan de correccion

## Alcance y seleccion

La matriz vigente de `HALLAZGOS.md` no contiene hallazgos con estado
`Pendiente`; por lo tanto, no hay IDs que seleccionar ni propuestas de
correccion que planificar en esta iteracion.

| ID | Estado en `HALLAZGOS.md` | Decision |
|---|---|---|
| H-01 | Resuelto | Excluido: ya se documenta que el token se mantiene en memoria. |
| H-02 | Resuelto | Excluido: ya se documenta que el mensaje usa interpolacion de texto. |
| H-03 | Resuelto | Excluido: ya se documenta la separacion de HTTP, sesion y configuracion. |
| H-04 | Resuelto | Excluido: ya se documenta la resolucion del hallazgo sobre Axios y Lodash. |
| H-05 | Resuelto | Excluido: ya se documenta el tipado y la simplificacion del flujo. |
| H-06 | No encontrado | Excluido: la matriz no confirma este hallazgo. |
| H-07 | Resuelto | Excluido: ya se documenta la ampliacion de pruebas. |

## Contrato y cambios de codigo

Este plan no propone cambios de codigo ni de contratos HTTP. Se conservan
`POST /auth/login` y `GET /api/tasks`, con los cuerpos, parametros,
encabezados y comportamientos descritos en `docs/ENDPOINTS.md`.

No se definen archivos a tocar ni pruebas de caracterizacion: al no haber
hallazgos pendientes seleccionados, no corresponde modificar componentes ni
servicios. Si la matriz cambia y vuelve a marcar un hallazgo como `Pendiente`,
se debera actualizar este plan con su problema, cambio propuesto, archivos
afectados y prueba de caracterizacion previa, respetando `docs/GOOD_PRACTICES.md`
y `REGLAS.md`.
