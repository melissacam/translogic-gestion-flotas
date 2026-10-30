import { session } from '../core/session';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
const TIEMPO_MAXIMO_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;
  readonly mensajes: string[];

  constructor(status: number, mensajes: string[]) {
    super(mensajes.join('. '));
    this.status = status;
    this.mensajes = mensajes;
  }

  get esConflicto(): boolean {
    return this.status === 409;
  }

  get sinConexion(): boolean {
    return this.status === 0;
  }
}

export type Parametros = Record<string, string | number | boolean | undefined | null>;

// Se dispara al recibir 401: el router lleva al login
let alExpirar: (() => void) | null = null;
export function alExpirarSesion(fn: () => void): void {
  alExpirar = fn;
}

function construirUrl(ruta: string, params?: Parametros): string {
  const url = new URL(`${BASE}${ruta}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function ejecutar(metodo: string, ruta: string, cuerpo?: unknown, params?: Parametros): Promise<Response> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  const token = session.token();
  try {
    const res = await fetch(construirUrl(ruta, params), {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: controlador.signal,
    });
    if (!res.ok) await lanzarError(res, ruta);
    return res;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const abortado = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError(0, [
      abortado ? 'El servidor tardó demasiado en responder' : 'Sin conexión con el servidor. Revisa tu red.',
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}

async function lanzarError(res: Response, ruta: string): Promise<never> {
  let mensajes: string[] = [`Error ${res.status}`];
  try {
    const cuerpo = (await res.json()) as { message?: string | string[] };
    if (cuerpo.message) mensajes = Array.isArray(cuerpo.message) ? cuerpo.message : [cuerpo.message];
  } catch {
    // cuerpo no JSON
  }
  if (res.status === 401 && ruta !== '/auth/login') {
    session.cerrar();
    alExpirar?.();
    mensajes = ['Tu sesión expiró. Inicia sesión nuevamente.'];
  }
  if (res.status === 403) mensajes = ['No tienes permisos para realizar esta acción.'];
  throw new ApiError(res.status, mensajes);
}

export const http = {
  async get<T>(ruta: string, params?: Parametros): Promise<T> {
    return (await ejecutar('GET', ruta, undefined, params)).json() as Promise<T>;
  },
  async post<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return (await ejecutar('POST', ruta, cuerpo)).json() as Promise<T>;
  },
  async patch<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return (await ejecutar('PATCH', ruta, cuerpo)).json() as Promise<T>;
  },
  async delete<T>(ruta: string): Promise<T> {
    return (await ejecutar('DELETE', ruta)).json() as Promise<T>;
  },
  async blob(ruta: string): Promise<{ blob: Blob; nombre: string | null }> {
    const res = await ejecutar('GET', ruta);
    const disposicion = res.headers.get('Content-Disposition') ?? '';
    const nombre = /filename="?([^"]+)"?/.exec(disposicion)?.[1] ?? null;
    return { blob: await res.blob(), nombre };
  },
};

export type Filtros = Record<string, string | number | boolean | undefined>;
