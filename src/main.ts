import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Увеличиваем лимит размера тела запроса до 5MB (для больших запросов от Judge)
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));
  
  // Устанавливаем таймауты для длинных соединений (10 минут)
  const TEN_MINUTES = 10 * 60 * 1000; // 600000ms
  const httpServer = app.getHttpServer();
  
  httpServer.setTimeout(TEN_MINUTES);           // Таймаут сокета
  httpServer.keepAliveTimeout = TEN_MINUTES;    // Keep-alive таймаут
  
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
