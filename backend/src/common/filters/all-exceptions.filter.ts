import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

interface ErrorMongo {
  name?: string;
  code?: number;
  keyValue?: Record<string, unknown>;
  errorLabels?: string[];
  errorLabelSet?: Set<string>;
  message?: string;
}

interface Respuesta {
  status: number;
  message: string | string[];
}

const NOMBRES_ESTADO: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

// Formato uniforme de errores: { statusCode, error, message, path, timestamp }
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { status, message } = this.traducir(exception);

    // Se registran 5xx y conflictos de concurrencia, sin cuerpo ni credenciales
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status === 409) {
      this.logger.warn(
        `Conflicto ${req.method} ${req.originalUrl}: ${String(message)}`,
      );
    }

    res.status(status).json({
      statusCode: status,
      error: NOMBRES_ESTADO[status] ?? HttpStatus[status] ?? 'Error',
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private traducir(exception: unknown): Respuesta {
    if (exception instanceof HttpException) {
      const cuerpo = exception.getResponse();
      const message =
        typeof cuerpo === 'string'
          ? cuerpo
          : ((cuerpo as { message?: string | string[] }).message ??
            exception.message);
      return { status: exception.getStatus(), message };
    }
    if (exception instanceof MongooseError.CastError) {
      return { status: 400, message: `Valor inválido para ${exception.path}` };
    }
    if (exception instanceof MongooseError.ValidationError) {
      return {
        status: 400,
        message: Object.values(exception.errors).map((e) => e.message),
      };
    }
    const err = exception as ErrorMongo;
    // E11000: violación de índice único → 409
    if (err?.code === 11000) {
      const campo = Object.keys(err.keyValue ?? {})[0] ?? 'clave';
      return {
        status: 409,
        message: `Ya existe un registro con ese valor de ${campo}`,
      };
    }
    // WriteConflict que agotó los reintentos de withTransaction → 409
    if (
      err?.code === 112 ||
      this.tieneEtiqueta(err, 'TransientTransactionError')
    ) {
      return {
        status: 409,
        message:
          'Otra operación modificó los mismos datos. Actualiza e inténtalo de nuevo.',
      };
    }
    if (err?.code === 121) {
      return {
        status: 400,
        message: 'El documento no cumple el validador de la colección',
      };
    }
    return { status: 500, message: 'Error interno del servidor' };
  }

  private tieneEtiqueta(err: ErrorMongo, etiqueta: string): boolean {
    return Boolean(
      err?.errorLabels?.includes(etiqueta) || err?.errorLabelSet?.has(etiqueta),
    );
  }
}
