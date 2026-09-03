import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy, requireSecret } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({ useFactory: () => ({ secret: requireSecret() }) }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
