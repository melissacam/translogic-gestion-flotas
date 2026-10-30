import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const inicio = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.registrar(req, http.getResponse<Response>().statusCode, inicio),
        error: (err: { status?: number }) =>
          this.registrar(req, err?.status ?? 500, inicio),
      }),
    );
  }

  private registrar(req: Request, status: number, inicio: number): void {
    this.logger.log(
      `${req.method} ${req.originalUrl} ${status} ${Date.now() - inicio}ms`,
    );
  }
}
