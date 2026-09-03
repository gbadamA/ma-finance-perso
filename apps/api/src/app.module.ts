import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { DataModule } from "./modules/data/data.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DataModule,
    ReceiptsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Garde GLOBAL : toute route exige un jeton, sauf celles marquees
    // `@Public()`. Fermer par defaut, ouvrir explicitement — l'inverse
    // laisserait une route ouverte au premier oubli.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
