import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app/app.module";
import { ValidationPipe } from "@nestjs/common";
// import { CorrelationMiddleware } from "./common/correlation.middleware"; // <-- The Error was here
import { correlation } from "./common/correlation.middleware"; // <-- Correct Import
import { PrismaClient } from "@excelcare/db";

async function bootstrap() {
  // 1. DEBUG: Print the Database URL being used
  console.log("------------------------------------------------------------------");
  console.log("🛑 DEBUG: DATABASE_URL is:", process.env.DATABASE_URL);
  console.log("------------------------------------------------------------------");

  const app = await NestFactory.create(AppModule);
  
  // 2. Global Config
  app.setGlobalPrefix(process.env.API_GLOBAL_PREFIX || "api");
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });
  
  // 3. Register Middleware (Function style)
  app.use(correlation); 
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 4. START SERVER
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/${process.env.API_GLOBAL_PREFIX || "api"}`);

  // 5. MANUAL DB CHECK (Runs after server starts)
  checkDatabase();
}

async function checkDatabase() {
  console.log("🔍 Checking Database content...");
  const prisma = new PrismaClient();
  try {
    const count = await prisma.user.count();
    console.log(`📊 Current User Count in DB: ${count}`);
    
    if (count === 0) {
      console.log("⚠️ Database is EMPTY. The Seed script did not run or failed.");
    } else {
      const users = await prisma.user.findMany();
      console.log("✅ Users found:", users.map(u => u.email));
    }
  } catch (error) {
    console.error("❌ Database Connection Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrap();