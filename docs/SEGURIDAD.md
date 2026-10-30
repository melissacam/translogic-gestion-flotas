# Seguridad

## D.1 ¿Por qué validar solo en el frontend no garantiza integridad?
1. **El cliente no es confiable.** El código del frontend se ejecuta en el dispositivo del usuario: cualquiera puede abrir las herramientas del navegador, modificar el JavaScript o desactivar validaciones.
2. **La API se puede llamar sin la interfaz.** Con Postman, `curl` o un script se envían peticiones directamente a `/api/servicios` con una carga de 50 000 kg, una batería de 140 % o una tarifa manipulada; si el servidor no valida, se guardan.
3. **Condiciones de carrera.** El frontend no ve lo que hacen otros usuarios al mismo tiempo. Dos operadores pueden ver el mismo vehículo "libre" y asignarlo; solo el servidor, con transacciones e índices únicos, puede decidir cuál operación se confirma.
4. **Reglas que dependen de datos del servidor.** Descuentos por número de servicios del mes, unicidad de códigos o si un servicio ya fue facturado requieren consultar la base de datos.
5. **Varios clientes, una sola fuente de verdad.** Si mañana existe una app nativa u otra integración, todas comparten el backend; las reglas deben vivir allí.

Por eso se aplica **defensa en profundidad**: validación en el frontend (experiencia de usuario, respuesta inmediata) + DTOs con class-validator + reglas en los servicios + validadores `$jsonSchema` e índices únicos en MongoDB + transacciones.

## D.2 Medidas implementadas
| Medida | Implementación |
|---|---|
| Contraseñas | bcrypt (12 rondas), hash nunca expuesto |
| Autenticación | JWT firmado con secreto de entorno y expiración |
| Autorización | `RolesGuard` con roles ADMINISTRADOR / OPERADOR |
| Fuerza bruta | límite de intentos en `/auth/login` |
| Entrada | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` |
| Cabeceras | `helmet`; CORS restringido |
| Integridad | índices únicos, validadores de colección, transacciones |
| Concurrencia | `version` + WriteConflict en transacción |
| Facturas duplicadas | update condicional `facturaId: null` + índice único en `detalles_factura.servicioId` |
| Errores | filtro global con formato uniforme y registro de errores relevantes |
| Secretos | `.env` fuera del repositorio, solo `.env.example` versionado |
