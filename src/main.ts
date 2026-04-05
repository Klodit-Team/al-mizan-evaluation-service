import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Health check
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Swagger (no Bearer auth - handled by API Gateway via session cookies)
  const config = new DocumentBuilder()
    .setTitle('Evaluation Service API')
    .setDescription(
      "API de gestion des évaluations d'offres, de la notation, du calcul des scores et du classement - Al-Mizan",
    )
    .setVersion('1.0')
    .addServer('http://localhost:8008', 'Local (dev direct)')
    .addServer('/api/evaluation', 'Via API Gateway')
    .addTag('evaluations', "Gestion des évaluations d'offres")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 8008;
  await app.listen(port);
  console.log(`Evaluation Service lancé sur http://localhost:${port}`);
  console.log(`Swagger UI disponible sur http://localhost:${port}/api/docs`);
}
bootstrap();
