import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AdminUser } from "./entities/admin-user.entity";
import { OtpCode } from "./entities/otp-code.entity";
import { AdminSession } from "./entities/admin-session.entity";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { AdminBootstrapService } from "./admin-bootstrap.service";
import { SessionActivityInterceptor } from "./interceptors/session-activity.interceptor";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, OtpCode, AdminSession]),
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "dev-secret"),
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AdminBootstrapService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SessionActivityInterceptor,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
