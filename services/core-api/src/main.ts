import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { correlation } from "./common/correlation.middleware";
import { initOtel } from "./otel";
import { AppModule } from "./modules/app/app.module";

async function bootstrap() {
  await initOtel();
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(correlation);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const basePath = process.env.API_BASE_PATH ?? "/api";
  app.setGlobalPrefix(basePath.replace(/^\/+/, ""));

  const config = new DocumentBuilder().setTitle("ExcelCare Core API").setVersion("0.1.1").build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${basePath.replace(/\/+$/, "")}/docs`.replace(/\/\//g, "/"), app, doc);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`Core API: http://localhost:${port}${basePath}`);
}

void bootstrap();
