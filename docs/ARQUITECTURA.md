# Arquitectura

## B.1 Tres capas
```mermaid
flowchart LR
    subgraph Cliente["Capa de presentación (móvil / navegador)"]
        UI["Vite + TypeScript + Tailwind CSS<br/>SPA Mobile First"]
    end
    subgraph Servidor["Capa de negocio — NestJS / Node.js"]
        C["Controllers<br/>(REST + DTO + Swagger)"]
        S["Services<br/>(reglas, estrategias de tarifa,<br/>máquina de estados, transacciones)"]
        R["Repositories<br/>(Mongoose / agregaciones)"]
        G["Guards JWT + Roles<br/>Filtro global de excepciones"]
    end
    subgraph Datos["Capa de datos"]
        DB[("MongoDB Atlas<br/>translogic_db<br/>replica set")]
    end
    UI -- "HTTPS JSON + Bearer JWT" --> G --> C --> S --> R --> DB
```

## B.2 Patrones aplicados
| Patrón | Dónde | Por qué |
|---|---|---|
| Strategy + Factory | `tarifas/` | cada tipo de vehículo calcula su tarifa sin condicionales dispersos; agregar un tipo nuevo no modifica el código existente (principio abierto/cerrado) |
| Repository | `*.repository.ts` | aísla Mongoose; los servicios no dependen del motor de base de datos |
| DTO | `dto/` | contrato de entrada validado y documentado en Swagger |
| State machine | `servicios/estado.maquina.ts` | transiciones explícitas y verificables |
| Unit of Work (transacción) | facturación, asignación, cambio de estado | todo o nada |
| Optimistic locking | campo `version` | evita confirmar sobre datos desactualizados |

## B.3 Concurrencia en la asignación (caso crítico)
```mermaid
sequenceDiagram
    participant O1 as Operador 1
    participant O2 as Operador 2
    participant API as API NestJS
    participant DB as MongoDB (transacción)
    O1->>API: PATCH /servicios/A/asignacion (vehículo V, 08:00-10:00)
    O2->>API: PATCH /servicios/B/asignacion (vehículo V, 09:00-11:00)
    API->>DB: T1: $inc version de V
    API->>DB: T2: $inc version de V
    DB-->>API: T2 WriteConflict (V ya modificado por T1)
    API->>DB: T1: sin solapamiento → asigna A → commit
    API-->>O1: 200 OK
    API->>DB: T2 reintenta: ve A asignado 08:00-10:00 → solapa
    API-->>O2: 409 Conflict
```

## B.4 Facturación atómica
```mermaid
sequenceDiagram
    participant A as Administrador
    participant API as FacturasService
    participant DB as MongoDB
    A->>API: POST /facturas {clienteId, servicioIds}
    API->>DB: startTransaction
    API->>DB: validar servicios COMPLETADO y sin factura
    API->>DB: $inc contador → FAC-AAAAMM-0001
    API->>DB: insertar factura
    API->>DB: updateMany servicios facturaId (condicional)
    API->>DB: insertMany detalles (índice único servicioId)
    alt todo correcto
        API->>DB: commit
        API-->>A: 201 factura con desglose
    else cualquier error
        API->>DB: abort (rollback)
        API-->>A: 409 / 422 sin factura parcial
    end
```
