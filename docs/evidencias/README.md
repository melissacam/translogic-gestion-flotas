# Evidencias

Generadas el 2026-10-30 sobre MongoDB Atlas (`translogic_db`) y MongoDB en memoria (replica set) para las pruebas.

| Archivo | Contenido | Cómo regenerarlo |
|---|---|---|
| `pruebas-unitarias.txt` | 32 pruebas unitarias (Jest) | `npm --prefix backend test -- --verbose` |
| `pruebas-integracion.txt` | 36 pruebas de integración con `MongoMemoryReplSet` | `npm --prefix backend run test:e2e -- --verbose` |
| `migraciones-seed-atlas.txt` | `migrate:up`, `migrate:status` y `seed` contra Atlas | `npm --prefix backend run db:reset` |
| `flujo-e2e.txt` | login → vehículo → cliente → servicio → simulación → asignación → inicio → fin → factura → PDF → rentabilidad | API levantada + `npm --prefix backend run flujo:demo` |
| `factura-ejemplo.pdf` | comprobante generado en el flujo anterior | ídem |
| `capturas/*.png` | interfaz a 390×844 (y una a 1366 px) recorrida con Playwright | API + `npm --prefix frontend run dev` + `npm --prefix frontend run capturas` |

Capturas: login, panel, vehículos, lista de servicios, formulario con simulación de tarifa en vivo, detalle con historial, confirmación de cambio de estado, facturación, detalle de factura, reportes (consulta 1 y consulta 8) y panel en escritorio.
