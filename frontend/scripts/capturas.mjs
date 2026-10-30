// Capturas móviles (390×844) del flujo principal con Playwright; requiere API y Vite levantados
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const URL_APP = process.env.APP_URL ?? 'http://localhost:5173';
const DESTINO = process.env.CAPTURAS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'evidencias', 'capturas');
mkdirSync(DESTINO, { recursive: true });

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-EC' });
const errores = [];
pagina.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
pagina.on('console', (m) => m.type() === 'error' && errores.push(`console: ${m.text()}`));

const capturar = async (nombre) => {
  await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: join(DESTINO, `${nombre}.png`) });
  console.log(`✔ ${nombre}.png`);
};

// 1. Login
await pagina.goto(`${URL_APP}/#/login`);
await pagina.getByLabel('Correo electrónico').waitFor();
await capturar('01-login');
await pagina.getByLabel('Correo electrónico').fill('admin@translogic.ec');
await pagina.getByLabel('Contraseña').fill('Admin123*');
await pagina.getByRole('button', { name: 'Ingresar' }).click();

// 2. Dashboard
await pagina.getByText('Panel de rentabilidad').waitFor();
await pagina.getByText('Rentabilidad por vehículo').waitFor();
await capturar('02-dashboard');
await pagina.screenshot({ path: join(DESTINO, '02b-dashboard-completo.png'), fullPage: true });

// 3. Vehículos
await pagina.goto(`${URL_APP}/#/vehiculos`);
await pagina.getByText('registros · página', { exact: false }).waitFor();
await capturar('03-vehiculos');

// 4. Formulario de servicio con simulación en vivo
await pagina.goto(`${URL_APP}/#/servicios`);
await pagina.getByText('registros · página', { exact: false }).waitFor();
await capturar('04-servicios-lista');
await pagina.getByRole('button', { name: 'Nuevo servicio' }).first().click();
const dialogo = pagina.getByRole('dialog');
await dialogo.getByLabel('Código').fill(`SRV-CAP-${Date.now().toString().slice(-5)}`);
await dialogo.getByLabel('Cliente').selectOption({ index: 1 });
await dialogo.getByLabel('Origen').fill('Guayaquil');
await dialogo.getByLabel('Destino').fill('Cuenca');
await dialogo.getByLabel('Distancia (km)').fill('320');
await dialogo.getByLabel('Peso de la carga (kg)').fill('900');
await dialogo.getByLabel('Vehículo (opcional)').selectOption({ index: 1 });
await dialogo.getByText('Importe estimado').waitFor();
await dialogo.getByText('Importe estimado').scrollIntoViewIfNeeded();
await capturar('05-servicio-simulacion');
await dialogo.getByRole('button', { name: 'Cerrar' }).click();

// 5. Cambio de estado con modal de confirmación
await pagina.getByText('Filtros y orden').click();
await pagina.getByLabel('Estado', { exact: true }).selectOption('PROGRAMADO');
await pagina.waitForTimeout(800);
await pagina.locator('ul li button').first().click();
await pagina.getByText('Historial de estados').waitFor();
await capturar('06-servicio-detalle');
const iniciar = pagina.getByRole('dialog').getByRole('button', { name: /Iniciar|Cancelar/ }).first();
await iniciar.click();
await pagina.getByText('Volver').waitFor();
await capturar('07-cambio-estado-confirmacion');
await pagina.keyboard.press('Escape');
await pagina.keyboard.press('Escape');

// 6. Facturación
await pagina.goto(`${URL_APP}/#/facturas`);
await pagina.getByText('registros · página', { exact: false }).waitFor();
await capturar('08-facturacion');
await pagina.locator('ul li button').first().click();
await pagina.getByText('Descargar comprobante PDF').waitFor();
await capturar('09-factura-detalle');
await pagina.keyboard.press('Escape');

// 7. Reportes
await pagina.goto(`${URL_APP}/#/reportes`);
await pagina.getByText('resultado', { exact: false }).first().waitFor();
await capturar('10-reportes');
await pagina.getByRole('tab', { name: /8\./ }).click();
await pagina.waitForTimeout(800);
await capturar('11-reporte-caida-facturacion');

// 8. Vista de escritorio del panel
await pagina.setViewportSize({ width: 1366, height: 900 });
await pagina.goto(`${URL_APP}/#/dashboard`);
await pagina.getByText('Rentabilidad por vehículo').waitFor();
await capturar('12-dashboard-escritorio');

await navegador.close();
if (errores.length) {
  console.error('Errores en la consola del navegador:\n' + errores.join('\n'));
  process.exit(1);
}
console.log(`Capturas guardadas en ${DESTINO}`);
