import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';

// Charge .env si présent
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [k, ...rest] = line.trim().replace(/^#.*/, '').split('=');
    if (k && rest.length) process.env[k.trim()] ??= rest.join('=').trim();
  }
}

async function bootstrap() {
  // Pas de CORS : l'interface est servie par CET addon (même origine que son API), y compris embarquée
  // (/addon-proxy/tickets/) ou en iframe — aucun site tiers n'a de raison d'appeler cette API depuis un navigateur.
  const app = await NestFactory.create(AppModule, {
    cors: false,
    bodyParser: false,
    logger: ['error', 'warn', 'log'],
  });
  // Pièces jointes envoyées en base64 (3 × 2 Mo max) : limite de corps relevée pour CET addon seulement.
  app.use(json({ limit: '10mb' }));
  (app.getHttpAdapter().getInstance() as any).disable('x-powered-by');
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  const port = parseInt(process.env.PORT ?? '3107', 10);
  await app.listen(port);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       UHQ Tickets Addon — NestJS     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  URL      : http://localhost:${port}`);
  console.log(`  Manifest : http://localhost:${port}/uhq-manifest.json`);
  console.log(`  Panel    : ${process.env.PANEL_URL ?? 'http://localhost:8000'}`);
  console.log('');
}

bootstrap();
