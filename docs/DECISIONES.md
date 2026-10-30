# Decisiones y supuestos

1. **Base de datos:** MongoDB Atlas, base `translogic_db`, ODM Mongoose.
2. **Costo operativo de la furgoneta** = costo energético + USD 18. El enunciado define la tarifa como (costo energético + 18) × 1.30; se interpreta el USD 18 como costo fijo operativo (manipulación, peajes, tiempo del conductor), análogo al camión, donde la tarifa es costo operativo × 1.35. Esto permite comparar rentabilidad entre tipos con el mismo criterio.
3. **Mes para descuentos:** mes calendario de la fecha de la factura; se cuentan los servicios del cliente en estado COMPLETADO con fecha en ese mes, estén o no en la factura.
4. **Domingo:** se evalúa sobre la fecha de inicio del servicio en la zona America/Guayaquil.
5. **Autonomía para el recargo del 10 %:** se usa la autonomía nominal (`autonomiaKm`); para permitir el inicio del servicio se usa la autonomía **disponible** según el porcentaje de batería.
6. **Tarifa del servicio:** se calcula al asignar vehículo (depende del tipo); los recargos de facturación se guardan también en el servicio para los reportes de ingresos y se recalculan al facturar.
7. **Impuesto configurable:** variable `IVA_TASA` (15 % por defecto, tarifa vigente de IVA en Ecuador).
8. **Comprobante:** PDF simulado sin validez tributaria ante el SRI.
9. **Eliminación de vehículos:** lógica (estado `INACTIVO`) para conservar la trazabilidad histórica.
10. **Operador:** puede gestionar servicios y consultar vehículos; facturación y reportes son exclusivos del administrador.

## Decisiones tomadas durante la implementación

11. **Credenciales fuera del repositorio:** `backend/.env.example` usa una URI con marcadores (`<usuario>:<password>@<cluster>`). La URI real vive solo en `backend/.env`, que está en `.gitignore`.
12. **NestJS 12 se distribuye solo como ESM:** el backend compila a CommonJS y Node ≥ 22.12 carga los paquetes ESM con `require()`. Jest 30 necesita `--experimental-vm-modules` para hacer lo mismo, por eso los scripts `test` y `test:e2e` lo incluyen. Requisito: **Node 24 LTS (24.9 o superior)**.
13. **TypeScript:** el backend usa TS 6 en modo `strict` porque ts-jest todavía no es compatible con TS 7. El frontend usa TS 7 (`strict`, sin emitir).
14. **Formato JSON de importes:** un interceptor global convierte cada `Decimal128` en string. Los importes salen con 2 decimales (`"229.50"`). Los precios unitarios (`precioLitro`, `costoKWh`, `costoMantenimientoKm`) conservan hasta 4 decimales para no perder información (`"0.085"`). `_id` se expone como `id`.
15. **Redondeo de agregaciones:** MongoDB redondea *half-even*, así que no se usa `$round` sobre dinero. Las sumas de importes ya redondeados son exactas en `Decimal128`, y el valor final se formatea *half-up* al serializar.
16. **Fecha de la factura:** el frontend envía la fecha de hoy si el mes elegido es el actual y, si no, el último día de ese mes. Así el descuento cuenta los servicios del mes que se está facturando.
17. **Mes del descuento:** se cuentan los servicios COMPLETADO del cliente cuya `fecha` (día local del servicio) cae en el mes de la factura.
18. **Vehículos asignables:** se aceptan los que están DISPONIBLE o EN_SERVICIO, porque un vehículo en ruta puede tener servicios futuros sin solaparse. MANTENIMIENTO e INACTIVO responden 422. Para iniciar un servicio, el vehículo no puede tener otro servicio EN_EJECUCION (409).
19. **Bloqueo optimista expuesto al cliente:** asignación y edición aceptan `version` (opcional). Si no coincide con la versión actual del servicio, la respuesta es 409 y la UI pide actualizar. Sin `version`, la protección es la del update condicional dentro de la transacción.
20. **Consulta 8:** si un cliente no tiene facturas en el mes, se toma como 0 (`$densify`), lo que cuenta como una caída del 100 %. Valores por defecto de los reportes: rango de los últimos 30 días y, para la consulta 8, el mes anterior.
21. **Consulta 6:** la "facturación" es la suma del `importe` de los detalles (tarifa + recargos, antes de descuento e IVA), agrupada por el mes de la factura y el tipo de vehículo.
22. **Promedio de categoría (eficiencia):** promedio simple de las eficiencias (km/USD) de los vehículos del mismo tipo con servicios completados, sin ponderar. Es el mismo criterio de la consulta 7.
23. **Seed determinístico:** `_id` fijos y datos sin aleatoriedad. Las fechas son relativas al día de ejecución (últimos 6 meses), así que dos ejecuciones el mismo día producen la misma base. El hash bcrypt cambia en cada ejecución por la sal; es lo esperado.
24. **Batería de furgonetas:** no se descuenta sola al completar un servicio. El operador actualiza el porcentaje (permiso explícito en la matriz de roles).
25. **Edición de servicios:** `PATCH /servicios/:id` no cambia el vehículo. Para eso está `PATCH /servicios/:id/asignacion`, que aplica el control de concurrencia. Al editar se recalcula la tarifa y se vuelve a validar el solapamiento del vehículo ya asignado.
26. **Clientes para OPERADOR:** listar y crear. Ver por id, editar y eliminar son solo para ADMINISTRADOR. Un cliente con servicios no puede eliminarse (409).
27. **Lint:** el backend usa oxlint (incluido en el scaffold de Nest 12) más `tsc --noEmit`. El frontend usa `tsc --noEmit` en modo estricto.
28. **Componentes de estado:** `skeleton`, `empty-state` y error con "Reintentar" están juntos en `frontend/src/components/estados.ts`. En móvil, si un rol tiene más de 5 secciones, la barra inferior muestra 4 y un botón "Más".
