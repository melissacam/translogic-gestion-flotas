import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../app.module';
import {
  EstadoServicio,
  EstadoVehiculo,
  Rol,
  TipoVehiculo,
} from '../common/enums';
import { aDecimal128 } from '../common/utils/decimal.util';
import { combinarFechaHora, inicioDelDia } from '../common/utils/fecha.util';
import { FacturasService } from '../facturas/facturas.service';
import { HistorialRepository } from '../historial/historial.repository';
import { ServiciosRepository } from '../servicios/servicios.repository';
import { ServiciosService } from '../servicios/servicios.service';
import { TarifasService } from '../tarifas/tarifas.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VehiculoLean } from '../vehiculos/schemas/vehiculo.schema';

const COLECCIONES = [
  'usuarios',
  'clientes',
  'vehiculos',
  'servicios',
  'historial_estados',
  'facturas',
  'detalles_factura',
  'contadores',
];

// Ids fijos: cada ejecución produce los mismos _id (seed determinístico, sin aleatoriedad)
function oid(prefijo: number, n: number): Types.ObjectId {
  return new Types.ObjectId(
    `5e1d${prefijo.toString(16).padStart(2, '0')}${n.toString(16).padStart(18, '0')}`,
  );
}

const CLIENTES = [
  [
    '1790016919001',
    'Corporación Favorita C.A.',
    'logistica@favorita.ec',
    '0223456789',
  ],
  [
    '0990004196001',
    'Industrial Pesquera Santa Priscila',
    'despachos@santapriscila.ec',
    '0423456781',
  ],
  [
    '0991331859001',
    'Distribuidora Andina del Pacífico',
    'compras@andinapacifico.ec',
    '0987654321',
  ],
  [
    '1791251237001',
    'Agrícola Valle Verde S.A.',
    'operaciones@valleverde.ec',
    '0998877665',
  ],
  ['0102030405', 'María Fernanda Ortiz', 'mfortiz@correo.ec', '0991122334'],
  [
    '0190123456001',
    'Cerámica del Austro Cía. Ltda.',
    'envios@ceramicaaustro.ec',
    '0722334455',
  ],
  ['1712345678', 'Carlos Andrés Muñoz', 'camunoz@correo.ec', '0976543210'],
  [
    '1390012345001',
    'Exportadora Manabí Fresh',
    'logistica@manabifresh.ec',
    '0955667788',
  ],
];

const CAMIONES = [
  ['GBA-1021', 'Hino', '500 FC', 2021, 10000, 30, '2.50', 3, '0.10', 84500],
  ['GBC-2045', 'Isuzu', 'FVR', 2020, 12000, 32, '2.48', 3, '0.12', 132000],
  ['PBD-3310', 'Volvo', 'FH 460', 2022, 20000, 38, '2.55', 5, '0.15', 61000],
  [
    'MBE-4120',
    'Mercedes-Benz',
    'Atego 1726',
    2019,
    8000,
    26,
    '2.45',
    2,
    '0.09',
    158400,
  ],
  [
    'UBF-5532',
    'Chevrolet',
    'NPR 816',
    2018,
    5000,
    18,
    '2.40',
    2,
    '0.08',
    201300,
  ],
] as const;

const FURGONETAS = [
  ['GEA-6011', 'BYD', 'T3', 2024, 1500, 50, 18, '0.10', 280, 90],
  ['PEB-6123', 'JAC', 'iEV1200T', 2023, 1200, 40, 16, '0.09', 250, 75],
  ['GEC-6235', 'Renault', 'Kangoo E-Tech', 2024, 800, 45, 17, '0.11', 265, 60],
  ['AED-6347', 'Maxus', 'eDeliver 9', 2023, 2000, 88, 25, '0.12', 350, 100],
  ['TEE-6459', 'Foton', 'eView', 2022, 1600, 60, 20, '0.10', 300, 50],
] as const;

const DISTANCIAS = [120, 340, 80, 210, 150, 60, 420, 95, 180];
const FRACCION_CARGA = [0.5, 0.85, 0.3, 0.6, 0.9, 0.2, 0.7, 0.4, 0.82];
const RUTAS = [
  ['Guayaquil', 'Quito'],
  ['Guayaquil', 'Cuenca'],
  ['Quito', 'Ambato'],
  ['Manta', 'Guayaquil'],
  ['Machala', 'Guayaquil'],
  ['Quito', 'Ibarra'],
  ['Guayaquil', 'Loja'],
  ['Durán', 'Babahoyo'],
  ['Cuenca', 'Machala'],
];

interface Plan {
  clienteIdx: number;
  vehiculoIdx: number | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  distanciaKm: number;
  fraccionCarga: number;
  estado: EstadoServicio;
  ruta: string[];
}

async function main() {
  const log = { log: (m: string) => console.log(`[seed] ${m}`) };
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const conexion = app.get<Connection>(getConnectionToken());
  const zona = app.get(ConfigService).getOrThrow<string>('ZONA_HORARIA');
  const tarifas = app.get(TarifasService);
  const serviciosService = app.get(ServiciosService);
  const serviciosRepo = app.get(ServiciosRepository);
  const historialRepo = app.get(HistorialRepository);
  const facturas = app.get(FacturasService);
  const db = conexion.db!;

  // 1) Limpieza: se vacían los datos y se conservan validadores, índices y changelog
  for (const nombre of COLECCIONES) await db.collection(nombre).deleteMany({});
  log.log('Colecciones vaciadas (changelog intacto)');

  // 2) Usuarios con bcrypt
  const usuarios = app.get(UsuariosService);
  const admin = await usuarios.crear(
    'Andrea Salazar',
    'admin@translogic.ec',
    'Admin123*',
    Rol.ADMINISTRADOR,
  );
  const operador = await usuarios.crear(
    'Luis Cevallos',
    'operador@translogic.ec',
    'Operador123*',
    Rol.OPERADOR,
  );
  const adminId = admin!._id.toString();
  const operadorId = operador!._id;

  // 3) Clientes
  const clientes = CLIENTES.map(
    ([identificacion, nombre, correo, telefono], i) => ({
      _id: oid(1, i + 1),
      identificacion,
      nombre,
      correo,
      telefono,
    }),
  );
  await conexion.model('Cliente').insertMany(clientes);

  // 4) Vehículos: 5 camiones y 5 furgonetas (discriminadores)
  const vehiculos: VehiculoLean[] = [
    ...CAMIONES.map(
      ([placa, marca, modelo, anio, cap, cons, precio, ejes, mant, km], i) => ({
        _id: oid(2, i + 1),
        tipo: TipoVehiculo.CAMION_CARGA,
        placa,
        marca,
        modelo,
        anio,
        capacidadCargaKg: cap,
        kilometraje: km,
        estado: EstadoVehiculo.DISPONIBLE,
        version: 0,
        consumoLitros100Km: cons,
        precioLitro: aDecimal128(precio),
        numeroEjes: ejes,
        costoMantenimientoKm: aDecimal128(mant),
      }),
    ),
    ...FURGONETAS.map(
      ([placa, marca, modelo, anio, cap, bat, cons, kwh, aut, pct], i) => ({
        _id: oid(2, i + 6),
        tipo: TipoVehiculo.FURGONETA_ELECTRICA,
        placa,
        marca,
        modelo,
        anio,
        capacidadCargaKg: cap,
        kilometraje: 12000 + i * 4300,
        estado: EstadoVehiculo.DISPONIBLE,
        version: 0,
        capacidadBateriaKWh: bat,
        consumoKWh100Km: cons,
        costoKWh: aDecimal128(kwh),
        autonomiaKm: aut,
        porcentajeBateria: pct,
      }),
    ),
  ] as VehiculoLean[];

  // 5) Plan de ~60 servicios en los últimos 6 meses (fechas relativas al mes actual)
  const hoy = DateTime.now().setZone(zona).startOf('day');
  const activos = [0, 1, 2, 3, 5, 6, 7, 8]; // UBF-5532 y TEE-6459 quedan sin servicios recientes
  const plan: Plan[] = [];
  for (let k = 5; k >= 1; k--) {
    const mes = hoy.minus({ months: k }).startOf('month');
    const primerDomingo = mes.plus({ days: (7 - mes.weekday) % 7 });
    for (let i = 0; i < 9; i++) {
      let clienteIdx = (i + k) % 8;
      // Patrones exigidos: ≥ 6 completados (cliente 0) y 3–5 (cliente 1) en un mismo mes
      if (k === 2) clienteIdx = i < 6 ? 0 : 2;
      if (k === 3 && i < 4) clienteIdx = 1;
      // Cliente 2: factura alta hace 2 meses y baja el mes pasado (consulta 8: caída > 20 %)
      if (k === 1 && clienteIdx === 2 && i !== 5) clienteIdx = 4;
      if (k === 1 && i === 5) clienteIdx = 2;
      const fecha = i === 4 ? primerDomingo : mes.plus({ days: 1 + i * 3 });
      plan.push({
        clienteIdx,
        vehiculoIdx: activos[(i * 3 + k) % 8],
        fecha: fecha.toISODate()!,
        horaInicio: '08:00',
        horaFin: '13:00',
        distanciaKm: DISTANCIAS[i],
        fraccionCarga: FRACCION_CARGA[i],
        estado:
          i === 7 && k % 2 === 1
            ? EstadoServicio.CANCELADO
            : EstadoServicio.COMPLETADO,
        ruta: RUTAS[i],
      });
    }
  }
  // Servicios antiguos de los vehículos que luego quedan sin asignaciones recientes
  for (const [j, vehiculoIdx] of [4, 4, 9, 9].entries()) {
    plan.push({
      clienteIdx: 5 + (j % 3),
      vehiculoIdx,
      fecha: hoy
        .minus({ months: 5 })
        .startOf('month')
        .plus({ days: 10 + j * 4 })
        .toISODate()!,
      horaInicio: '14:00',
      horaFin: '18:00',
      distanciaKm: [140, 260, 90, 170][j],
      fraccionCarga: 0.5,
      estado: EstadoServicio.COMPLETADO,
      ruta: RUTAS[j + 2],
    });
  }
  // Últimos días: completados, un cancelado, uno en ejecución y programados futuros
  [25, 22, 19, 16, 13, 10, 7, 4].forEach((dias, i) =>
    plan.push({
      clienteIdx: i < 4 ? 3 : (i + 2) % 8,
      vehiculoIdx: activos[(i * 5) % 8],
      fecha: hoy.minus({ days: dias }).toISODate()!,
      horaInicio: '14:00',
      horaFin: '18:00',
      distanciaKm: DISTANCIAS[(i + 2) % 9],
      fraccionCarga: FRACCION_CARGA[(i + 3) % 9],
      estado: EstadoServicio.COMPLETADO,
      ruta: RUTAS[(i + 4) % 9],
    }),
  );
  plan.push({
    clienteIdx: 6,
    vehiculoIdx: 2,
    fecha: hoy.minus({ days: 2 }).toISODate()!,
    horaInicio: '07:00',
    horaFin: '11:00',
    distanciaKm: 110,
    fraccionCarga: 0.4,
    estado: EstadoServicio.CANCELADO,
    ruta: RUTAS[3],
  });
  plan.push({
    clienteIdx: 0,
    vehiculoIdx: 0,
    fecha: hoy.toISODate()!,
    horaInicio: '06:00',
    horaFin: '13:00',
    distanciaKm: 270,
    fraccionCarga: 0.88,
    estado: EstadoServicio.EN_EJECUCION,
    ruta: RUTAS[0],
  });
  [1, 2, 3, 4, 6].forEach((dias, i) =>
    plan.push({
      clienteIdx: (i + 1) % 8,
      vehiculoIdx: i < 3 ? activos[(i * 3 + 1) % 8] : null,
      fecha: hoy.plus({ days: dias }).toISODate()!,
      horaInicio: '09:00',
      horaFin: '13:00',
      distanciaKm: DISTANCIAS[(i + 5) % 9],
      fraccionCarga: FRACCION_CARGA[i],
      estado: EstadoServicio.PROGRAMADO,
      ruta: RUTAS[(i + 6) % 9],
    }),
  );

  // 6) Servicios con tarifa calculada por las mismas estrategias del backend
  const servicios: Record<string, unknown>[] = [];
  const historial: Record<string, unknown>[] = [];
  const kmExtra = new Map<number, number>();
  plan.forEach((p, n) => {
    const _id = oid(3, n + 1);
    const inicio = combinarFechaHora(p.fecha, p.horaInicio, zona);
    const finEstimada = combinarFechaHora(p.fecha, p.horaFin, zona);
    const vehiculo = p.vehiculoIdx === null ? null : vehiculos[p.vehiculoIdx];
    const pesoCargaKg = vehiculo
      ? Math.round(vehiculo.capacidadCargaKg * p.fraccionCarga)
      : 400;
    let calculo = {};
    let recarga = false;
    if (vehiculo) {
      const c = tarifas.calcularCompleto(
        vehiculo,
        p.distanciaKm,
        pesoCargaKg,
        inicio,
      );
      calculo = serviciosService.importes(c, vehiculo);
      recarga = Boolean(c.tarifa.autonomiaDisponibleKm?.lt(p.distanciaKm));
    }
    const completado = p.estado === EstadoServicio.COMPLETADO;
    if (completado && p.vehiculoIdx !== null) {
      kmExtra.set(
        p.vehiculoIdx,
        (kmExtra.get(p.vehiculoIdx) ?? 0) + p.distanciaKm,
      );
    }
    servicios.push({
      _id,
      codigo: `SRV-${p.fecha.slice(0, 7).replace('-', '')}-${String(n + 1).padStart(3, '0')}`,
      clienteId: clientes[p.clienteIdx]._id,
      vehiculoId: vehiculo?._id ?? null,
      origen: p.ruta[0],
      destino: p.ruta[1],
      distanciaKm: p.distanciaKm,
      pesoCargaKg,
      fecha: inicioDelDia(p.fecha, zona),
      horaInicio: p.horaInicio,
      horaFinEstimada: p.horaFin,
      inicio,
      finEstimada,
      estado: p.estado,
      recargaPlanificada: recarga,
      ...calculo,
      kilometrajeAplicado: completado,
      facturaId: null,
      completadoEn: completado ? finEstimada : null,
      version: 1,
      creadoPor: operadorId,
    });
    // Historial coherente con el estado final de cada servicio
    const pasos: [EstadoServicio | null, EstadoServicio, Date][] = [
      [
        null,
        EstadoServicio.PROGRAMADO,
        DateTime.fromJSDate(inicio).minus({ days: 3 }).toJSDate(),
      ],
    ];
    if (p.estado === EstadoServicio.CANCELADO) {
      pasos.push([
        EstadoServicio.PROGRAMADO,
        EstadoServicio.CANCELADO,
        DateTime.fromJSDate(inicio).minus({ hours: 12 }).toJSDate(),
      ]);
    }
    if (p.estado === EstadoServicio.EN_EJECUCION || completado) {
      pasos.push([
        EstadoServicio.PROGRAMADO,
        EstadoServicio.EN_EJECUCION,
        inicio,
      ]);
    }
    if (completado)
      pasos.push([
        EstadoServicio.EN_EJECUCION,
        EstadoServicio.COMPLETADO,
        finEstimada,
      ]);
    pasos.forEach(([estadoAnterior, estadoNuevo, fecha], j) =>
      historial.push({
        _id: oid(4, n * 10 + j + 1),
        servicioId: _id,
        estadoAnterior,
        estadoNuevo,
        fecha,
        usuarioId: j === 0 ? operadorId : admin!._id,
      }),
    );
  });

  // Kilometraje coherente con los servicios completados; estados según la operación
  vehiculos.forEach((v, i) => {
    v.kilometraje += kmExtra.get(i) ?? 0;
  });
  vehiculos[0].estado = EstadoVehiculo.EN_SERVICIO;
  vehiculos[9].estado = EstadoVehiculo.MANTENIMIENTO;
  const modeloVehiculo = conexion.model('Vehiculo');
  for (const v of vehiculos) {
    const modelo =
      v.tipo === TipoVehiculo.CAMION_CARGA
        ? modeloVehiculo.discriminators!.CamionCarga
        : modeloVehiculo.discriminators!.FurgonetaElectrica;
    await modelo.create(v);
  }
  await serviciosRepo.insertarVarios(servicios);
  await historialRepo.insertarVarios(historial as never);
  log.log(
    `${clientes.length} clientes, ${vehiculos.length} vehículos, ${servicios.length} servicios, ${historial.length} cambios de estado`,
  );

  // 7) Facturas de meses anteriores emitidas con el MISMO servicio de facturación (transacción)
  let emitidas = 0;
  for (let k = 5; k >= 1; k--) {
    const mes = hoy.minus({ months: k });
    const periodo = mes.toFormat('yyyy-MM');
    for (const cliente of clientes) {
      const ids = servicios
        .filter(
          (s) =>
            s.clienteId === cliente._id &&
            s.estado === EstadoServicio.COMPLETADO &&
            String(s.codigo).startsWith(`SRV-${periodo.replace('-', '')}`),
        )
        .map((s) => String(s._id));
      if (ids.length === 0) continue;
      await facturas.crear(
        {
          clienteId: cliente._id.toString(),
          servicioIds: ids,
          fecha: mes.endOf('month').toISODate()!,
        },
        {
          id: adminId,
          email: 'admin@translogic.ec',
          nombre: 'Andrea Salazar',
          rol: Rol.ADMINISTRADOR,
        },
      );
      emitidas++;
    }
  }
  log.log(`${emitidas} facturas emitidas para los meses anteriores`);
  log.log(
    'Usuarios: admin@translogic.ec / Admin123* · operador@translogic.ec / Operador123*',
  );
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
