import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình CORS chi tiết để Vercel không chặn nữa
  app.enableCors({
    origin: true, // Cho phép mọi nguồn gọi vào (hoặc thay bằng domain frontend cụ thể của bạn)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.use('/public', express.static(join(__dirname, '..', 'public')));

  await app.listen(3000);
}
bootstrap();
