import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Flujo de punta a punta contra la API levantada (datos persistidos en MongoDB)
const API = process.env.API_URL ?? 'http://localhost:3000/api';
const EVIDENCIAS = join(__dirname, '..', '..', 'docs', 'evidencias');
const lineas: string[] = [];

function registrar(texto: string) {
  console.log(texto);
  lineas.push(texto);
}

async function llamar<T = Record<string, unknown>>(
  paso: string,
  metodo: string,
  ruta: string,
  token?: string,
  cuerpo?: unknown,
): Promise<T> {
  const inicio = Date.now();
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const ms = Date.now() - inicio;
  const datos = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : Buffer.from(await res.arrayBuffer());
  registrar(`\n## ${paso}\n${metodo} ${ruta} → ${res.status} (${ms} ms)`);
  if (!res.ok) {
    registrar(JSON.stringify(datos, null, 2));
    throw new Error(`Paso fallido: ${paso}`);
  }
  return datos as T;
}

function hoyGuayaquil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
  }).format(new Date());
}

async function main() {
  const marca = String(Date.now()).slice(-6);
  const fecha = hoyGuayaquil();
  registrar(
    `# Flujo e2e TRANSLOGIC — ${new Date().toISOString()}\nAPI: ${API}`,
  );

  const sesion = await llamar<{
    accessToken: string;
    usuario: Record<string, string>;
  }>('1. Login administrador', 'POST', '/auth/login', undefined, {
    email: 'admin@translogic.ec',
    password: 'Admin123*',
  });
  const t = sesion.accessToken;
  registrar(`Usuario: ${sesion.usuario.nombre} (${sesion.usuario.rol})`);

  const vehiculo = await llamar(
    '2. Crear camión de carga',
    'POST',
    '/vehiculos',
    t,
    {
      tipo: 'CAMION_CARGA',
      placa: `TLD-${marca.slice(-4)}`,
      marca: 'Hino',
      modelo: '500 FC',
      anio: 2023,
      capacidadCargaKg: 10000,
      kilometraje: 1000,
      consumoLitros100Km: 30,
      precioLitro: 2.5,
      numeroEjes: 3,
      costoMantenimientoKm: 0.1,
    },
  );
  registrar(`Vehículo ${String(vehiculo.placa)} · id ${String(vehiculo.id)}`);

  const cliente = await llamar('3. Crear cliente', 'POST', '/clientes', t, {
    identificacion: `17${marca}01`,
    nombre: `Cliente Demo ${marca}`,
    correo: `demo${marca}@translogic.ec`,
    telefono: '0991234567',
  });
  registrar(`Cliente ${String(cliente.nombre)} · id ${String(cliente.id)}`);

  const servicio = await llamar(
    '4. Crear servicio (PROGRAMADO, sin vehículo)',
    'POST',
    '/servicios',
    t,
    {
      codigo: `SRV-DEMO-${marca}`,
      clienteId: cliente.id,
      origen: 'Guayaquil',
      destino: 'Quito',
      distanciaKm: 200,
      pesoCargaKg: 9000,
      fecha,
      horaInicio: '08:00',
      horaFinEstimada: '12:00',
    },
  );
  registrar(
    `Servicio ${String(servicio.codigo)} · estado ${String(servicio.estado)}`,
  );

  const simulacion = await llamar(
    '5. Simular tarifa (no persiste)',
    'POST',
    '/servicios/simular-tarifa',
    t,
    {
      vehiculoId: vehiculo.id,
      distanciaKm: 200,
      pesoCargaKg: 9000,
      fecha,
    },
  );
  registrar(
    `Costo operativo ${String(simulacion.costoOperativo)} · base ${String(simulacion.tarifaBase)} · ajuste ${String(simulacion.ajustePorcentaje)} % · tarifa ${String(simulacion.tarifa)} · recargos ${String(simulacion.recargos)} · importe ${String(simulacion.importe)}`,
  );

  const asignado = await llamar(
    '6. Asignar vehículo (transacción + control de concurrencia)',
    'PATCH',
    `/servicios/${String(servicio.id)}/asignacion`,
    t,
    {
      vehiculoId: vehiculo.id,
    },
  );
  registrar(
    `Tarifa persistida ${String(asignado.tarifa)} (recalculada por el backend)`,
  );

  await llamar(
    '7. Iniciar servicio',
    'PATCH',
    `/servicios/${String(servicio.id)}/estado`,
    t,
    { estado: 'EN_EJECUCION' },
  );
  const completado = await llamar(
    '8. Completar servicio',
    'PATCH',
    `/servicios/${String(servicio.id)}/estado`,
    t,
    {
      estado: 'COMPLETADO',
    },
  );
  registrar(
    `Estado ${String(completado.estado)} · kilometrajeAplicado ${String(completado.kilometrajeAplicado)}`,
  );
  const v2 = await llamar(
    '8b. Verificar kilometraje del vehículo',
    'GET',
    `/vehiculos/${String(vehiculo.id)}`,
    t,
  );
  registrar(
    `Kilometraje 1000 → ${String(v2.kilometraje)} · estado ${String(v2.estado)}`,
  );

  const historial = await llamar<Record<string, string>[]>(
    '8c. Historial de estados',
    'GET',
    `/servicios/${String(servicio.id)}/historial`,
    t,
  );
  historial.forEach((h) =>
    registrar(
      `  ${h.estadoAnterior ?? '—'} → ${h.estadoNuevo} por ${h.usuarioNombre}`,
    ),
  );

  const factura = await llamar(
    '9. Generar factura (transacción atómica)',
    'POST',
    '/facturas',
    t,
    {
      clienteId: cliente.id,
      servicioIds: [servicio.id],
    },
  );
  registrar(
    `Factura ${String(factura.codigo)} · subtotal ${String(factura.subtotal)} · recargos ${String(factura.recargos)} · descuento ${String(factura.descuento)} · IVA ${String(factura.impuesto)} · TOTAL ${String(factura.total)}`,
  );

  const pdf = await llamar<Buffer>(
    '10. Descargar comprobante PDF',
    'GET',
    `/facturas/${String(factura.id)}/pdf`,
    t,
  );
  mkdirSync(EVIDENCIAS, { recursive: true });
  writeFileSync(join(EVIDENCIAS, 'factura-ejemplo.pdf'), pdf);
  registrar(
    `PDF guardado (${pdf.length} bytes) → docs/evidencias/factura-ejemplo.pdf`,
  );

  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  const rent = await llamar<{ kpis: Record<string, string> }>(
    '11. Consultar rentabilidad del mes',
    'GET',
    `/reportes/rentabilidad?anio=${anio}&mes=${mes}`,
    t,
  );
  registrar(
    `KPIs ${anio}-${String(mes).padStart(2, '0')}: ${JSON.stringify(rent.kpis)}`,
  );

  registrar('\nRESULTADO: flujo completo OK');
  writeFileSync(join(EVIDENCIAS, 'flujo-e2e.txt'), lineas.join('\n') + '\n');
}

main().catch((err: unknown) => {
  registrar(
    `\nRESULTADO: FALLÓ — ${err instanceof Error ? err.message : String(err)}`,
  );
  mkdirSync(EVIDENCIAS, { recursive: true });
  writeFileSync(join(EVIDENCIAS, 'flujo-e2e.txt'), lineas.join('\n') + '\n');
  process.exit(1);
});
