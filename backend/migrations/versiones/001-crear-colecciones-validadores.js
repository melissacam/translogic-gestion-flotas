// Migración 001: colecciones con validador $jsonSchema (defensa en profundidad en la BD)
const ROLES = ['ADMINISTRADOR', 'OPERADOR'];
const TIPOS = ['CAMION_CARGA', 'FURGONETA_ELECTRICA'];
const ESTADOS_VEHICULO = [
  'DISPONIBLE',
  'EN_SERVICIO',
  'MANTENIMIENTO',
  'INACTIVO',
];
const ESTADOS_SERVICIO = [
  'PROGRAMADO',
  'EN_EJECUCION',
  'COMPLETADO',
  'CANCELADO',
];

const numero = { bsonType: 'number' };
const positivo = { bsonType: 'number', minimum: 0, exclusiveMinimum: true };
const noNegativo = { bsonType: 'number', minimum: 0 };
const dinero = { bsonType: 'decimal' };
const dineroONulo = { bsonType: ['decimal', 'null'] };
const texto = { bsonType: 'string', minLength: 1 };

const VALIDADORES = {
  usuarios: {
    bsonType: 'object',
    required: ['nombre', 'email', 'passwordHash', 'rol', 'activo'],
    properties: {
      nombre: texto,
      email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+$' },
      passwordHash: { bsonType: 'string', minLength: 50 },
      rol: { enum: ROLES },
      activo: { bsonType: 'bool' },
    },
  },
  clientes: {
    bsonType: 'object',
    required: ['identificacion', 'nombre', 'correo', 'telefono'],
    properties: {
      identificacion: { bsonType: 'string', pattern: '^(\\d{10}|\\d{13})$' },
      nombre: texto,
      correo: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+$' },
      telefono: { bsonType: 'string', pattern: '^\\d{10}$' },
    },
  },
  vehiculos: {
    bsonType: 'object',
    required: [
      'placa',
      'marca',
      'modelo',
      'anio',
      'capacidadCargaKg',
      'kilometraje',
      'tipo',
      'estado',
      'version',
    ],
    properties: {
      placa: { bsonType: 'string', pattern: '^[A-Z]{3}-?\\d{3,4}$' },
      marca: texto,
      modelo: texto,
      anio: { bsonType: 'number', minimum: 1990 },
      capacidadCargaKg: positivo,
      kilometraje: noNegativo,
      tipo: { enum: TIPOS },
      estado: { enum: ESTADOS_VEHICULO },
      version: noNegativo,
      consumoLitros100Km: positivo,
      precioLitro: dinero,
      numeroEjes: { bsonType: 'number', minimum: 2 },
      costoMantenimientoKm: dinero,
      capacidadBateriaKWh: positivo,
      consumoKWh100Km: positivo,
      costoKWh: dinero,
      autonomiaKm: positivo,
      porcentajeBateria: { bsonType: 'number', minimum: 0, maximum: 100 },
    },
    // Campos obligatorios según el subtipo (discriminador `tipo`)
    oneOf: [
      {
        properties: { tipo: { enum: ['CAMION_CARGA'] } },
        required: [
          'consumoLitros100Km',
          'precioLitro',
          'numeroEjes',
          'costoMantenimientoKm',
        ],
      },
      {
        properties: { tipo: { enum: ['FURGONETA_ELECTRICA'] } },
        required: [
          'capacidadBateriaKWh',
          'consumoKWh100Km',
          'costoKWh',
          'autonomiaKm',
          'porcentajeBateria',
        ],
      },
    ],
  },
  servicios: {
    bsonType: 'object',
    required: [
      'codigo',
      'clienteId',
      'origen',
      'destino',
      'distanciaKm',
      'pesoCargaKg',
      'fecha',
      'inicio',
      'finEstimada',
      'estado',
      'kilometrajeAplicado',
      'version',
    ],
    properties: {
      codigo: texto,
      clienteId: { bsonType: 'objectId' },
      vehiculoId: { bsonType: ['objectId', 'null'] },
      origen: texto,
      destino: texto,
      distanciaKm: positivo,
      pesoCargaKg: noNegativo,
      fecha: { bsonType: 'date' },
      inicio: { bsonType: 'date' },
      finEstimada: { bsonType: 'date' },
      estado: { enum: ESTADOS_SERVICIO },
      recargaPlanificada: { bsonType: 'bool' },
      costoOperativo: dineroONulo,
      tarifa: dineroONulo,
      recargos: dineroONulo,
      importe: dineroONulo,
      kilometrajeAplicado: { bsonType: 'bool' },
      facturaId: { bsonType: ['objectId', 'null'] },
      completadoEn: { bsonType: ['date', 'null'] },
      version: noNegativo,
    },
  },
  historial_estados: {
    bsonType: 'object',
    required: ['servicioId', 'estadoNuevo', 'fecha', 'usuarioId'],
    properties: {
      servicioId: { bsonType: 'objectId' },
      estadoAnterior: { enum: [...ESTADOS_SERVICIO, null] },
      estadoNuevo: { enum: ESTADOS_SERVICIO },
      fecha: { bsonType: 'date' },
      usuarioId: { bsonType: 'objectId' },
    },
  },
  facturas: {
    bsonType: 'object',
    required: [
      'codigo',
      'clienteId',
      'fecha',
      'periodo',
      'subtotal',
      'recargos',
      'porcentajeDescuento',
      'descuento',
      'tasaImpuesto',
      'impuesto',
      'total',
    ],
    properties: {
      codigo: { bsonType: 'string', pattern: '^FAC-\\d{6}-\\d{4,}$' },
      clienteId: { bsonType: 'objectId' },
      fecha: { bsonType: 'date' },
      periodo: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}$' },
      subtotal: dinero,
      recargos: dinero,
      base: dinero,
      porcentajeDescuento: { bsonType: 'number', minimum: 0, maximum: 100 },
      descuento: dinero,
      baseImponible: dinero,
      tasaImpuesto: { bsonType: 'number', minimum: 0, maximum: 1 },
      impuesto: dinero,
      total: dinero,
    },
  },
  detalles_factura: {
    bsonType: 'object',
    required: ['facturaId', 'servicioId', 'tarifa', 'recargos', 'importe'],
    properties: {
      facturaId: { bsonType: 'objectId' },
      servicioId: { bsonType: 'objectId' },
      tarifa: dinero,
      porcentajeRecargo: numero,
      recargos: dinero,
      importe: dinero,
    },
  },
};

module.exports = {
  VALIDADORES,

  async up(db) {
    const existentes = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(
        (c) => c.name,
      ),
    );
    for (const [nombre, esquema] of Object.entries(VALIDADORES)) {
      const validator = { $jsonSchema: esquema };
      if (existentes.has(nombre)) {
        await db.command({
          collMod: nombre,
          validator,
          validationLevel: 'strict',
          validationAction: 'error',
        });
      } else {
        await db.createCollection(nombre, {
          validator,
          validationLevel: 'strict',
          validationAction: 'error',
        });
      }
    }
  },

  async down(db) {
    const existentes = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(
        (c) => c.name,
      ),
    );
    for (const nombre of Object.keys(VALIDADORES)) {
      if (existentes.has(nombre)) await db.collection(nombre).drop();
    }
  },
};
