import 'reflect-metadata';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // /api/health and /api/v1/... (spec §20-§21).
  // The central SSO callback stays at the root path, because that is the URL
  // registered for this subsystem in the Core Hub Subsystem Registry.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'auth/callback', method: RequestMethod.GET }, { path: 'auth/login', method: RequestMethod.GET }, { path: 'auth/logout', method: RequestMethod.POST }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  const port = config.get<number>('port', 4226);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(
    JSON.stringify({
      event: 'subsystem.started',
      subsystem: config.get<string>('subsystemId'),
      port,
      coreHubUrl: config.get<string>('coreHub.url'),
      jwksUrl: config.get<string>('coreHub.jwksUrl'),
      issuer: config.get<string>('coreHub.issuer'),
      audience: config.get<string>('coreHub.audience'),
    }),
  );
}

void bootstrap();
