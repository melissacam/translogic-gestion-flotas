# TRANSLOGIC S.A. — Gestión de flotas, servicios y facturación

Sistema web *mobile first* para una empresa de transporte. Gestiona una flota mixta (camiones de carga y furgonetas eléctricas), programa servicios de transporte con tarifas calculadas por tipo de vehículo, evita asignaciones simultáneas del mismo vehículo, factura de forma atómica y muestra indicadores de rentabilidad.

Proyecto del Examen Parcial I de Programación Móvil.

## Stack

| Capa | Tecnología |
|---|---|
| Presentación | Vite 8 · TypeScript (strict) · Tailwind CSS 4 (`@tailwindcss/vite`) · Chart.js · Lucide |
| Negocio | NestJS 12 · class-validator · Passport JWT · bcrypt · decimal.js · luxon · pdfkit · Swagger |
| Datos | MongoDB Atlas (replica set) · Mongoose 9 · migrate-mongo |
| Pruebas | Jest 30 · Supertest · mongodb-memory-server (`MongoMemoryReplSet`) · Playwright |

Arquitectura en tres capas y patrones aplicados: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Requisitos previos

- **Node.js 24 LTS** (24.9 o superior). NestJS 12 se publica como ESM y Jest lo carga con `--experimental-vm-modules`.
- Cuenta de **MongoDB Atlas** con un cluster (Atlas funciona como replica set, necesario para las transacciones).
- Git.

## Configuración

```bash
# 1. Variables de entorno
cp backend/.env.example backend/.env      # completar MONGODB_URI y JWT_SECRET
cp frontend/.env.example frontend/.env    # VITE_API_URL=http://localhost:3000/api

# 2. Dependencias (raíz, backend y frontend)
npm run install:all

# 3. Base de datos: colecciones con validadores, índices y contadores
npm --prefix backend run migrate:up

# 4. Datos de prueba determinísticos (usuarios, 8 clientes, 10 vehículos, ~60 servicios, facturas)
npm --prefix backend run seed
```

Variables del backend (si falta alguna, la API no arranca):

| Variable | Ejemplo | Uso |
|---|---|---|
| `PORT` | `3000` | puerto HTTP |
| `MONGODB_URI` | `mongodb+srv://…/translogic_db?…` | conexión a Atlas (base `translogic_db`) |
| `JWT_SECRET` | texto largo aleatorio | firma de tokens |
| `JWT_EXPIRES_IN` | `8h` | vigencia del token |
| `IVA_TASA` | `0.15` | impuesto de facturación |
| `ZONA_HORARIA` | `America/Guayaquil` | domingos, meses y horarios |
| `CORS_ORIGIN` | `http://localhost:5173` | origen permitido |

Otros scripts de base de datos: `migrate:status`, `migrate:down` (revierte la última), `db:reset` (revierte todo, migra y siembra).

## Ejecución

```bash
npm run dev        # API en http://localhost:3000/api y web en http://localhost:5173
```

- Swagger: **http://localhost:3000/api/docs** (el JSON exportado está en [docs/openapi.json](docs/openapi.json); se regenera con `npm --prefix backend run openapi`).
- Compilación de producción: `npm run build`.

### Credenciales de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| ADMINISTRADOR | `admin@translogic.ec` | `Admin123*` |
| OPERADOR | `operador@translogic.ec` | `Operador123*` |

## Pruebas

```bash
npm --prefix backend test          # 32 pruebas unitarias
npm --prefix backend run test:e2e  # 36 pruebas de integración (MongoDB en memoria con replica set)
npm --prefix backend run test:cov  # cobertura
npm run lint                       # oxlint + tsc (backend) y tsc strict (frontend)
```

Las pruebas de integración aplican las **mismas migraciones** que Atlas (validadores e índices únicos) y prueban, entre otros:

- Dos asignaciones simultáneas del mismo vehículo: una recibe 200 y la otra 409.
- El kilometraje se suma una sola vez aunque se complete dos veces.
- Una factura con un servicio inválido no deja nada guardado (rollback real).

Salidas guardadas en [docs/evidencias/](docs/evidencias/).

Flujo de punta a punta contra la API levantada: `npm --prefix backend run flujo:demo` (genera `docs/evidencias/flujo-e2e.txt` y `factura-ejemplo.pdf`). Capturas móviles: `npm --prefix frontend run capturas`.

## Flujo de demostración

1. **Login** como administrador.
2. **Vehículos → Nuevo vehículo:** crea un camión; los campos cambian según el tipo y se validan mientras escribes.
3. **Clientes → Nuevo cliente** (cédula de 10 dígitos o RUC de 13).
4. **Servicios → Nuevo servicio:** al elegir un vehículo, la tarifa se simula en vivo (desglose, ajuste por carga o autonomía, recargos por domingo o más de 300 km).
5. **Asignación:** en el detalle del servicio, elige el vehículo. Si otro operador lo tomó en ese horario, verás el aviso de concurrencia (409).
6. **Iniciar → Completar:** cada cambio pide confirmación y queda en el historial. Al completar se suma el kilometraje una sola vez.
7. **Facturación:** elige cliente y mes, marca los servicios, previsualiza el desglose, emite la factura y descarga el PDF.
8. **Panel:** KPIs, ingresos frente a costos, utilidad mensual, servicios por estado, distribución por tipo y rentabilidad por vehículo.

## Matriz de roles

| Recurso | ADMINISTRADOR | OPERADOR |
|---|---|---|
| Vehículos: listar, ver, eficiencia | ✔ | ✔ |
| Vehículos: crear, editar, desactivar | ✔ | solo editar kilometraje, batería y estado |
| Clientes | ✔ | listar y crear |
| Servicios: crear, editar, asignar, estados, historial, simular | ✔ | ✔ |
| Facturas | ✔ | ✘ (403) |
| Reportes y panel | ✔ | ✘ (403) |

## Estructura

```
translogic-gestion-flotas/
├── backend/
│   ├── migrations/            # migrate-mongo: 001 validadores, 002 índices, 003 contadores
│   ├── scripts/               # exportar-openapi.ts, flujo-e2e.ts
│   ├── src/
│   │   ├── auth/ usuarios/ clientes/ vehiculos/ tarifas/ servicios/ historial/ facturas/ reportes/
│   │   ├── common/            # filtros, guards, decoradores, interceptores, decimal y fechas
│   │   ├── database/          # conexión, transacciones, contadores
│   │   └── seed/seed.ts
│   └── test/                  # pruebas e2e (*.e2e-spec.ts)
├── frontend/
│   ├── scripts/capturas.mjs   # capturas 390×844 con Playwright
│   └── src/ api/ core/ components/ pages/ types/ main.ts styles.css
├── docs/                      # modelo, arquitectura, reglas, seguridad, decisiones, trazabilidad, OpenAPI, evidencias
└── package.json               # scripts raíz (concurrently)
```

## Documentación

- [Modelo de datos](docs/MODELO_DATOS.md) · [Arquitectura](docs/ARQUITECTURA.md) · [Reglas de negocio](docs/REGLAS_NEGOCIO.md)
- [Seguridad](docs/SEGURIDAD.md) · [Decisiones y supuestos](docs/DECISIONES.md)
- [Trazabilidad requisito → código → prueba](docs/TRAZABILIDAD.md)
