# Trazabilidad: requisito → implementación → prueba

Rutas relativas a la raíz del repositorio. `U-n` = prueba unitaria n (`backend/src/**/*.spec.ts`); `E-n` = prueba de integración n (`backend/test/*.e2e-spec.ts`). La numeración sigue la sección 3.13 de la especificación.

> Los numerales siguen los requisitos que cita la especificación de diseño (Req-01 a Req-09). Si el enunciado oficial usa otra numeración, la columna "Implementación" sigue siendo válida.

| # | Requisito | Implementación | Prueba / evidencia |
|---|---|---|---|
| 1 | **Req-01.1** Modelo de datos documental justificado | `docs/MODELO_DATOS.md`, `backend/src/*/schemas/*.schema.ts` | Diagrama ER, A.1 |
| 2 | **Req-01.2** Relaciones, claves e índices | `backend/migrations/versiones/002-indices-unicidad.js` | E-19 (código único → 409), E-18 (índice único `detalles_factura.servicioId`) |
| 3 | **Req-01.3** Evolución del esquema con migraciones | `backend/migrations/` (`up`/`down`, `changelog`), `autoIndex: false` en `database/database.module.ts` | `migrate:status`; `test/utilidades.ts` aplica las migraciones en cada suite |
| 4 | **Req-01.4** Arquitectura por capas (controller / service / repository / DTO) | cada módulo de `backend/src/` | `docs/ARQUITECTURA.md` |
| 5 | **Req-01.5** Validadores de colección (defensa en profundidad) | `001-crear-colecciones-validadores.js` (`$jsonSchema`, `oneOf` por tipo) | e2e: todas las escrituras pasan por los validadores |
| 6 | **Req-01.6** Datos de prueba reproducibles | `backend/src/seed/seed.ts` (ids fijos, facturas creadas con `FacturasService`) | `npm run seed` (salida en `docs/evidencias/`) |
| 7 | **Req-02** Herencia Vehículo → Camión / Furgoneta | `vehiculos/schemas/vehiculo.schema.ts` (discriminadores), `vehiculos.module.ts` | E auth: placa duplicada entre tipos → 409 |
| 8 | **Req-02** Tarifa polimórfica (Strategy + Factory) | `tarifas/estrategias/*.strategy.ts`, `tarifas/tarifa.factory.ts` | U-1 229.50 · U-2 247.86 · U-3 26.00 · U-4 30.60 |
| 9 | **Req-02** Autonomía disponible | `tarifa-furgoneta.strategy.ts` (`autonomiaDisponible`) | U-5 150 km |
| 10 | **Req-02** Validación de capacidad y batería | `estrategias/validaciones-tarifa.ts`, `vehiculos/dto/*.dto.ts` | U-6, U-7a (DTO), U-7b (servicio), E carga > capacidad → 422 |
| 11 | **Req-02** Eficiencia por vehículo | `vehiculos.repository.ts#eficiencia` (agregación + `$setWindowFields`) | flujo manual / Swagger |
| 12 | **Req-02** CRUD vehículos, búsqueda por placa, borrado lógico | `vehiculos.controller.ts`, `vehiculos.service.ts` | E auth: desactivar → INACTIVO |
| 13 | **Req-03** Registro de servicios (código único, distancia > 0) | `servicios/dto/crear-servicio.dto.ts`, `servicios.service.ts#crear` | E-19 |
| 14 | **Req-03** Máquina de estados | `servicios/estado.maquina.ts`, mapa de acciones en `servicios.service.ts` | U-8, E COMPLETADO → EN_EJECUCION → 409 |
| 15 | **Req-03.7 / 03.11** Asignación concurrente sin solapamiento | `servicios.service.ts#asignarEnSesion`, `vehiculos.repository.ts#tocar`, `database/transaccion.service.ts` | **E-14** (un 200 y un 409) |
| 16 | **Req-03** Kilometraje sumado una sola vez | `servicios.service.ts#completar` (update condicional) | **E-15** |
| 17 | **Req-03** Energía insuficiente / recarga planificada | `servicios.service.ts#iniciar` | **E-16** |
| 18 | **Req-03** Historial de estados auditado | `historial/`, registro dentro de la misma transacción | E-15 (historial con nombre de usuario) |
| 19 | **Req-03** Listado paginado con filtros y orden en el servidor | `servicios.repository.ts#listar` (`$facet`) | **E-20** |
| 20 | **Req-03** Simulación de tarifa sin persistir; el backend siempre recalcula | `servicios.service.ts#simularTarifa`, `ValidationPipe` `forbidNonWhitelisted` | E simulación; E-19 (tarifa manipulada → 400) |
| 21 | **Req-04** Recargos, descuento único e IVA con decimal.js | `facturas/calculo-factura.ts`, `tarifas/recargos.ts` | **U-9** 347.42 · **U-10** tramos · domingo en zona Guayaquil |
| 22 | **Req-04** Facturación atómica e integridad | `facturas.service.ts#crear` (transacción, `$inc` en contadores, update condicional, índice único) | **E-17**, **E-18**, E rollback real |
| 23 | **Req-04** Comprobante PDF | `facturas/pdf-factura.service.ts` | E PDF (`%PDF`), `docs/evidencias/factura-ejemplo.pdf` |
| 24 | **Req-05** Aritmética decimal exacta | `common/utils/decimal.util.ts`, `Decimal128`, `serializacion.interceptor.ts` | U decimal (0.1 + 0.2, half up, formato) |
| 25 | **Req-06** Frontend mobile first, asíncrono, estados de UI | `frontend/src/` (router con guards, `components/estados.ts`, tablas → tarjetas, modales como hoja inferior) | `docs/evidencias/capturas/` (Playwright 390×844) |
| 26 | **Req-07** Dashboard de rentabilidad (`$facet`) | `reportes.repository.ts#rentabilidad`, `frontend/src/pages/dashboard.ts` | **U-11** margen con ingresos 0 · E rentabilidad (KPIs, 12 meses) |
| 27 | **Req-08** 8 consultas avanzadas con agregaciones | `reportes.repository.ts#consulta1…8` | E consultas 1–8 → 200; E consulta 3 |
| 28 | **Req-09** Seguridad: bcrypt, JWT, roles, límite de intentos, helmet, CORS, filtro de errores | `auth/`, `common/guards/`, `common/filters/all-exceptions.filter.ts`, `app.setup.ts` | **E-12** (login, 401), **E-13** (403), E operador, E 429, E 400 id inválido |

## Pruebas exigidas (sección 3.13)

| N.º | Prueba | Archivo |
|---|---|---|
| 1–6, 7b | Tarifas y validaciones | `backend/src/tarifas/tarifas.spec.ts` |
| 7a | Batería fuera de rango en DTO | `backend/src/vehiculos/dto/crear-vehiculo.dto.spec.ts` |
| 8 | Máquina de estados | `backend/src/servicios/estado.maquina.spec.ts` |
| 9–10 | Factura de referencia y tramos de descuento | `backend/src/facturas/calculo-factura.spec.ts` |
| 11 | Margen con ingresos 0 (evaluado en MongoDB) | `backend/src/reportes/margen.spec.ts` |
| 12–13 | Login / 401 / 403 | `backend/test/auth.e2e-spec.ts` |
| 14–16, 19–20 | Concurrencia, kilometraje, energía, duplicados, paginación | `backend/test/servicios.e2e-spec.ts` |
| 17–18 | Factura atómica y duplicada | `backend/test/facturas.e2e-spec.ts` |
| extra | Reportes y consultas 1–8 | `backend/test/reportes.e2e-spec.ts` |
