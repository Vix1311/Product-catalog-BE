import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from '../src/app.module';

// Entry point cho Vercel Function. Không gọi app.listen(): Vercel tự gọi handler theo từng request.
let cachedServer: express.Express | null = null;

async function getServer(): Promise<express.Express> {
  if (cachedServer) return cachedServer;

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  server.use('/public', express.static(join(__dirname, '..', 'public')));

  await app.init();
  cachedServer = server;
  return server;
}

export default async function handler(
  req: express.Request,
  res: express.Response,
) {
  const server = await getServer();
  return server(req, res);
}
