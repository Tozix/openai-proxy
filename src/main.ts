import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Устанавливаем таймауты для длинных соединений (10 минут)
  const TEN_MINUTES = 10 * 60 * 1000; // 600000ms
  const httpServer = app.getHttpServer();
  
  httpServer.setTimeout(TEN_MINUTES);           // Таймаут сокета
  httpServer.keepAliveTimeout = TEN_MINUTES;    // Keep-alive таймаут
  
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
