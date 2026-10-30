import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { esDecimal128, formatoDinero } from '../common/utils/decimal.util';

// Misma paleta pastel del frontend
const COLOR = {
  tinta: '#2E3338',
  suave: '#5F6670',
  borde: '#E4E2DA',
  fondo: '#F6F5F1',
  salvia: '#A9C5B4',
  salviaFuerte: '#4D7A5F',
  mantequilla: '#F1E3B3',
};

type Doc = Record<string, unknown>;

function usd(valor: unknown): string {
  const texto = esDecimal128(valor)
    ? formatoDinero(valor.toString())
    : String(valor ?? '0.00');
  return `$ ${texto}`;
}

@Injectable()
export class PdfFacturaService {
  constructor(private readonly config: ConfigService) {}

  generar(factura: Doc): Promise<Buffer> {
    const zona = this.config.getOrThrow<string>('ZONA_HORARIA');
    const fechaTexto = (d: unknown) =>
      new Intl.DateTimeFormat('es-EC', {
        timeZone: zona,
        dateStyle: 'medium',
      }).format(d as Date);

    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ size: 'A4', margin: 48 });
      const partes: Buffer[] = [];
      pdf.on('data', (b: Buffer) => partes.push(b));
      pdf.on('end', () => resolve(Buffer.concat(partes)));
      pdf.on('error', reject);

      const ancho = pdf.page.width - 96;
      const cliente = (factura.cliente ?? {}) as Doc;
      const detalles = (factura.detalles ?? []) as Doc[];

      // Encabezado con logo textual
      pdf.rect(48, 48, ancho, 64).fill(COLOR.fondo);
      pdf
        .fillColor(COLOR.salviaFuerte)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('TRANSLOGIC S.A.', 64, 62);
      pdf
        .fillColor(COLOR.suave)
        .font('Helvetica')
        .fontSize(9)
        .text('Gestión de flotas y transporte', 64, 88);
      pdf
        .fillColor(COLOR.tinta)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(`Comprobante ${String(factura.codigo)}`, 300, 62, {
          width: ancho - 268,
          align: 'right',
        });
      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR.suave)
        .text(
          `Fecha: ${fechaTexto(factura.fecha)}  ·  Periodo: ${String(factura.periodo)}`,
          300,
          82,
          {
            width: ancho - 268,
            align: 'right',
          },
        );

      // Leyenda obligatoria
      pdf.rect(48, 124, ancho, 24).fill(COLOR.mantequilla);
      pdf
        .fillColor(COLOR.tinta)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          'Comprobante simulado — sin validez tributaria ante el SRI',
          48,
          131,
          { width: ancho, align: 'center' },
        );

      // Cliente
      let y = 164;
      pdf
        .fillColor(COLOR.tinta)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Cliente', 48, y);
      y += 16;
      pdf.font('Helvetica').fontSize(10).fillColor(COLOR.tinta);
      pdf.text(`${String(cliente.nombre ?? '')}`, 48, y);
      pdf
        .fillColor(COLOR.suave)
        .text(
          `Identificación: ${String(cliente.identificacion ?? '')}  ·  ${String(cliente.correo ?? '')}  ·  Tel. ${String(cliente.telefono ?? '')}`,
          48,
          y + 14,
        );
      y += 44;

      // Tabla de servicios
      const cols = [
        { t: 'Código', w: 120, a: 'left' },
        { t: 'Ruta', w: 135, a: 'left' },
        { t: 'Km', w: 50, a: 'right' },
        { t: 'Tarifa', w: 70, a: 'right' },
        { t: 'Recargos', w: 60, a: 'right' },
        { t: 'Importe', w: ancho - 435, a: 'right' },
      ] as const;
      const fila = (valores: string[], yy: number, negrita = false) => {
        let x = 48;
        pdf
          .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor(COLOR.tinta);
        valores.forEach((v, i) => {
          pdf.text(v, x + 6, yy + 6, {
            width: cols[i].w - 12,
            align: cols[i].a,
            lineBreak: false,
            ellipsis: true,
          });
          x += cols[i].w;
        });
      };
      pdf.rect(48, y, ancho, 22).fill(COLOR.salvia);
      fila(
        cols.map((c) => c.t),
        y,
        true,
      );
      y += 22;
      for (const d of detalles) {
        const s = (d.servicio ?? {}) as Doc;
        fila(
          [
            String(d.codigoServicio),
            `${String(s.origen ?? '')} - ${String(s.destino ?? '')}`,
            String(s.distanciaKm ?? ''),
            usd(d.tarifa),
            usd(d.recargos),
            usd(d.importe),
          ],
          y,
        );
        y += 22;
        pdf
          .moveTo(48, y)
          .lineTo(48 + ancho, y)
          .lineWidth(0.5)
          .strokeColor(COLOR.borde)
          .stroke();
        if (y > 680) {
          pdf.addPage();
          y = 48;
        }
      }

      // Desglose
      y += 16;
      const pct = Number(factura.porcentajeDescuento);
      const tasa = Number(factura.tasaImpuesto) * 100;
      const resumen: [string, string][] = [
        ['Subtotal', usd(factura.subtotal)],
        ['Recargos (domingo / > 300 km)', usd(factura.recargos)],
        ['Base', usd(factura.base)],
        [
          `Descuento ${pct} % (${String(factura.serviciosCompletadosMes)} completados en el mes)`,
          `- ${usd(factura.descuento)}`,
        ],
        ['Base imponible', usd(factura.baseImponible)],
        [`IVA ${tasa} %`, usd(factura.impuesto)],
      ];
      const xEtiqueta = 48 + ancho - 300;
      for (const [etiqueta, valor] of resumen) {
        pdf
          .font('Helvetica')
          .fontSize(10)
          .fillColor(COLOR.suave)
          .text(etiqueta, xEtiqueta, y, { width: 200 });
        pdf
          .fillColor(COLOR.tinta)
          .text(valor, xEtiqueta + 200, y, { width: 100, align: 'right' });
        y += 18;
      }
      pdf.rect(xEtiqueta - 8, y, 308, 30).fill(COLOR.salvia);
      pdf
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(COLOR.tinta)
        .text('TOTAL', xEtiqueta, y + 9, { width: 200 });
      pdf.text(usd(factura.total), xEtiqueta + 200, y + 9, {
        width: 100,
        align: 'right',
      });

      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR.suave)
        .text(
          'Documento generado por el sistema académico TRANSLOGIC. Comprobante simulado — sin validez tributaria ante el SRI.',
          48,
          780,
          { width: ancho, align: 'center' },
        );
      pdf.end();
    });
  }
}
