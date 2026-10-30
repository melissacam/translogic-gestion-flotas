// Migración 002: índices y restricciones de unicidad del Anexo A
const INDICES = [
  {
    coleccion: 'usuarios',
    clave: { email: 1 },
    opciones: { name: 'ux_usuarios_email', unique: true },
  },
  {
    coleccion: 'clientes',
    clave: { identificacion: 1 },
    opciones: { name: 'ux_clientes_identificacion', unique: true },
  },
  // Placa única entre camiones y furgonetas (misma colección)
  {
    coleccion: 'vehiculos',
    clave: { placa: 1 },
    opciones: { name: 'ux_vehiculos_placa', unique: true },
  },
  {
    coleccion: 'vehiculos',
    clave: { tipo: 1, estado: 1 },
    opciones: { name: 'ix_vehiculos_tipo_estado' },
  },
  {
    coleccion: 'servicios',
    clave: { codigo: 1 },
    opciones: { name: 'ux_servicios_codigo', unique: true },
  },
  // Detección de solapamiento de horarios por vehículo
  {
    coleccion: 'servicios',
    clave: { vehiculoId: 1, inicio: 1, finEstimada: 1 },
    opciones: { name: 'ix_servicios_vehiculo_horario' },
  },
  {
    coleccion: 'servicios',
    clave: { clienteId: 1, estado: 1, fecha: 1 },
    opciones: { name: 'ix_servicios_cliente_estado_fecha' },
  },
  {
    coleccion: 'servicios',
    clave: { estado: 1, fecha: -1 },
    opciones: { name: 'ix_servicios_estado_fecha' },
  },
  {
    coleccion: 'servicios',
    clave: { facturaId: 1 },
    opciones: { name: 'ix_servicios_factura' },
  },
  {
    coleccion: 'historial_estados',
    clave: { servicioId: 1, fecha: 1 },
    opciones: { name: 'ix_historial_servicio_fecha' },
  },
  {
    coleccion: 'facturas',
    clave: { codigo: 1 },
    opciones: { name: 'ux_facturas_codigo', unique: true },
  },
  {
    coleccion: 'facturas',
    clave: { clienteId: 1, fecha: -1 },
    opciones: { name: 'ix_facturas_cliente_fecha' },
  },
  // Última barrera contra doble facturación: un servicio en una sola factura
  {
    coleccion: 'detalles_factura',
    clave: { servicioId: 1 },
    opciones: { name: 'ux_detalles_servicio', unique: true },
  },
  {
    coleccion: 'detalles_factura',
    clave: { facturaId: 1 },
    opciones: { name: 'ix_detalles_factura' },
  },
];

module.exports = {
  INDICES,

  async up(db) {
    for (const { coleccion, clave, opciones } of INDICES) {
      await db.collection(coleccion).createIndex(clave, opciones);
    }
  },

  async down(db) {
    for (const { coleccion, opciones } of INDICES) {
      const existe = await db
        .collection(coleccion)
        .indexExists(opciones.name)
        .catch(() => false);
      if (existe) await db.collection(coleccion).dropIndex(opciones.name);
    }
  },
};
