import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { h } from './dom';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

// Misma paleta que @theme (styles.css)
export const PALETA = {
  tinta: '#2E3338',
  tintaSuave: '#5F6670',
  borde: '#E4E2DA',
  salvia: '#A9C5B4',
  salviaFuerte: '#4D7A5F',
  pervinca: '#BAC3E3',
  mantequilla: '#F1E3B3',
  melocoton: '#F2CDB9',
  mentaCielo: '#B9DCE3',
  rosaPolvo: '#E9BFC5',
};

Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = PALETA.tintaSuave;
Chart.defaults.borderColor = PALETA.borde;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.backgroundColor = PALETA.tinta;
Chart.defaults.animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 150 };

const graficos = new WeakMap<HTMLCanvasElement, Chart>();

export function grafico(config: ChartConfiguration, etiquetaAccesible: string, alto = 260): HTMLElement {
  const canvas = h('canvas', { role: 'img', 'aria-label': etiquetaAccesible });
  const contenedor = h('div', { class: 'relative w-full', style: `height:${alto}px` }, canvas);
  queueMicrotask(() => {
    graficos.get(canvas)?.destroy();
    graficos.set(canvas, new Chart(canvas, { ...config, options: { responsive: true, maintainAspectRatio: false, ...config.options } }));
  });
  return contenedor;
}
