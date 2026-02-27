import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Устанавливаем таймауты для длинных соединений (10 минут)
  const server = app.getHttpAdapter().getInstance();
  const TEN_MINUTES = 10 * 60 * 1000; // 600000ms
  
  server.setTimeout(TEN_MINUTES);           // Таймаут сокета
  server.keepAliveTimeout = TEN_MINUTES;    // Keep-alive таймаут
  
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
