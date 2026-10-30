# Modelo de datos

## A.1 Selección del modelo: documental (MongoDB Atlas)

Se eligió un **modelo documental** con referencias entre colecciones por estas razones:

1. **Polimorfismo natural de vehículos.** `CamionCarga` y `FurgonetaElectrica` comparten atributos de `Vehiculo` pero tienen campos propios. En MongoDB se guardan en una sola colección `vehiculos` con un discriminador `tipo`; en relacional exigiría herencia por tablas (JOIN adicional) o una tabla con muchas columnas nulas. Una sola colección permite además unicidad de `placa` entre ambos tipos y agregaciones por `tipo` en un solo `$group`.
2. **Instantáneas de cálculo.** Cada servicio guarda el desglose de su tarifa (`detalleCalculo`) tal como se calculó; si luego cambia el precio del litro o el costo del kWh, la tarifa histórica no se altera. Un subdocumento flexible es ideal para esto.
3. **Agregaciones potentes para BI.** Las 8 consultas avanzadas y el dashboard se resuelven con el *aggregation framework* (`$facet`, `$setWindowFields`, `$lookup` con pipeline) directamente en el servidor de base de datos.
4. **Transacciones ACID multi-documento.** Atlas funciona como *replica set*, lo que habilita transacciones para facturación, finalización de servicios y asignaciones concurrentes; la ventaja clásica del modelo relacional en integridad se conserva.

**Embeber vs. referenciar:**
| Relación | Decisión | Motivo |
|---|---|---|
| Servicio → Cliente, Vehículo | Referencia (`ObjectId`) | entidades independientes, se consultan por separado |
| Servicio → detalleCalculo | Embebido | se lee siempre con el servicio y es inmutable |
| Servicio → HistorialEstado | Colección aparte | crecimiento ilimitado (auditoría *append-only*); evita documentos que crecen sin límite |
| Factura → DetalleFactura | Colección aparte | el índice único sobre `servicioId` garantiza que un servicio aparezca en una sola factura en toda la base |
| Vehículo → CamionCarga / FurgonetaElectrica | Discriminador en la misma colección | herencia sin JOIN |

## A.2 Diagrama del modelo

```mermaid
erDiagram
    USUARIO ||--o{ HISTORIAL_ESTADO : "registra"
    CLIENTE ||--o{ SERVICIO_TRANSPORTE : "solicita"
    CLIENTE ||--o{ FACTURA : "recibe"
    VEHICULO ||--o{ SERVICIO_TRANSPORTE : "realiza"
    SERVICIO_TRANSPORTE ||--o{ HISTORIAL_ESTADO : "audita"
    FACTURA ||--|{ DETALLE_FACTURA : "contiene"
    SERVICIO_TRANSPORTE ||--o| DETALLE_FACTURA : "se factura una vez"

    VEHICULO {
        ObjectId _id PK
        string placa UK
        string marca
        string modelo
        int anio
        decimal capacidadCargaKg
        decimal kilometraje
        string tipo "CAMION_CARGA | FURGONETA_ELECTRICA"
        string estado "DISPONIBLE | EN_SERVICIO | MANTENIMIENTO | INACTIVO"
        int version "control de concurrencia"
        decimal consumoLitros100Km "solo camion"
        Decimal128 precioLitro "solo camion"
        int numeroEjes "solo camion"
        Decimal128 costoMantenimientoKm "solo camion"
        decimal capacidadBateriaKWh "solo furgoneta"
        decimal consumoKWh100Km "solo furgoneta"
        Decimal128 costoKWh "solo furgoneta"
        decimal autonomiaKm "solo furgoneta"
        decimal porcentajeBateria "solo furgoneta 0-100"
    }
    CLIENTE {
        ObjectId _id PK
        string identificacion UK
        string nombre
        string correo
        string telefono
        string direccion "opcional"
    }
    SERVICIO_TRANSPORTE {
        ObjectId _id PK
        string codigo UK
        ObjectId clienteId FK
        ObjectId vehiculoId FK "null hasta asignar"
        string origen
        string destino
        decimal distanciaKm "mayor a 0"
        decimal pesoCargaKg
        date fecha "inicio del dia local en UTC"
        string horaInicio "HH:mm local"
        string horaFinEstimada "HH:mm local"
        date inicio
        date finEstimada
        string estado
        bool recargaPlanificada
        Decimal128 costoOperativo
        Decimal128 tarifa
        Decimal128 recargos
        Decimal128 importe
        object detalleCalculo "instantanea embebida"
        bool kilometrajeAplicado
        ObjectId facturaId FK "null si no facturado"
        date completadoEn
        int version
        ObjectId creadoPor FK
    }
    FACTURA {
        ObjectId _id PK
        string codigo UK
        ObjectId clienteId FK
        date fecha
        string periodo "AAAA-MM"
        Decimal128 subtotal
        Decimal128 recargos
        Decimal128 base "subtotal + recargos"
        int serviciosCompletadosMes
        decimal porcentajeDescuento
        Decimal128 descuento
        Decimal128 baseImponible
        decimal tasaImpuesto
        Decimal128 impuesto
        Decimal128 total
        int cantidadServicios
        ObjectId emitidaPor FK
    }
    DETALLE_FACTURA {
        ObjectId _id PK
        ObjectId facturaId FK
        ObjectId servicioId FK,UK
        string codigoServicio
        Decimal128 tarifa
        decimal porcentajeRecargo
        Decimal128 recargos
        Decimal128 importe "tarifa + recargos"
    }
    USUARIO {
        ObjectId _id PK
        string nombre
        string email UK
        string passwordHash
        string rol "ADMINISTRADOR | OPERADOR"
        bool activo
    }
    HISTORIAL_ESTADO {
        ObjectId _id PK
        ObjectId servicioId FK
        string estadoAnterior
        string estadoNuevo
        date fecha
        ObjectId usuarioId FK
        string observacion "opcional"
    }
```

## A.3 Claves, índices y restricciones

| Colección | Índice | Tipo | Propósito |
|---|---|---|---|
| usuarios | `{ email: 1 }` | único | login, evita cuentas duplicadas |
| clientes | `{ identificacion: 1 }` | único | cédula/RUC sin repetir |
| vehiculos | `{ placa: 1 }` | único | búsqueda por placa y unicidad entre ambos tipos |
| vehiculos | `{ tipo: 1, estado: 1 }` | compuesto | filtros y agregaciones por categoría |
| servicios | `{ codigo: 1 }` | único | rechaza códigos duplicados |
| servicios | `{ vehiculoId: 1, inicio: 1, finEstimada: 1 }` | compuesto | detección de solapamiento de horarios |
| servicios | `{ clienteId: 1, estado: 1, fecha: 1 }` | compuesto | descuentos por mes y consultas por cliente |
| servicios | `{ estado: 1, fecha: -1 }` | compuesto | historial paginado y dashboard |
| servicios | `{ facturaId: 1 }` | simple | servicios pendientes de facturar |
| historial_estados | `{ servicioId: 1, fecha: 1 }` | compuesto | consulta de auditoría |
| facturas | `{ codigo: 1 }` | único | código correlativo sin repetir |
| facturas | `{ clienteId: 1, fecha: -1 }` | compuesto | consulta 8 y listado |
| detalles_factura | `{ servicioId: 1 }` | **único** | un servicio solo en una factura |
| detalles_factura | `{ facturaId: 1 }` | simple | armar el detalle de una factura |
| contadores | `{ _id: 1 }` | por defecto | secuencia de códigos de factura |

Restricciones adicionales mediante validadores `$jsonSchema` en cada colección (enums de estado, tipo y rol; mínimos `distanciaKm > 0`, `porcentajeBateria` 0–100, `anio` ≥ 1990) además de la validación de DTOs en NestJS: defensa en profundidad.

## A.4 Evolución del esquema
Las migraciones (`migrate-mongo`) crean colecciones, validadores e índices de forma versionada (`up`/`down`) y quedan registradas en la colección `changelog`. Los datos de prueba se cargan con `npm run seed`, que es determinístico: ejecutarlo dos veces produce la misma base.

## A.5 Ajustes respecto del diseño inicial

Durante la implementación se añadieron campos (ya reflejados en el diagrama) que no cambian las relaciones:

| Colección | Campos añadidos | Motivo |
|---|---|---|
| servicios | `horaInicio`, `horaFinEstimada`, `creadoPor` | editar el servicio con la hora local original y auditar quién lo creó |
| facturas | `base`, `baseImponible`, `serviciosCompletadosMes`, `cantidadServicios`, `emitidaPor` | el comprobante muestra el desglose guardado, sin recalcular en el frontend ni en el PDF |
| detalles_factura | `codigoServicio`, `porcentajeRecargo`, `importe` | la consulta 6 suma `importe` por tipo de vehículo y mes |
| historial_estados | `observacion` | motivo opcional de una cancelación |
| clientes | `direccion` | dato opcional del comprobante |

Todas las colecciones usan `versionKey: false`: el control de concurrencia usa el campo propio `version`.
Los vehículos se guardan con discriminadores de Mongoose (`discriminatorKey: 'tipo'`) y el validador `$jsonSchema` de la colección exige con `oneOf` los campos propios de cada subtipo.

