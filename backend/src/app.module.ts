import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./modules/auth/auth.module";
import { UssdModule } from "./modules/ussd/ussd.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AdminModule } from "./modules/admin/admin.module";
import { PlayerModule } from "./modules/player/player.module";
import { AdminUser } from "./modules/auth/entities/admin-user.entity";
import { OtpCode } from "./modules/auth/entities/otp-code.entity";
import { UssdSession } from "./modules/ussd/entities/ussd-session.entity";
import { PaymentTransaction } from "./modules/payments/entities/payment-transaction.entity";
import { PayoutRelease } from "./modules/payouts/entities/payout-release.entity";
import { Winner } from "./modules/payouts/entities/winner.entity";
import { Player } from "./modules/player/entities/player.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mariadb",
        host: config.get<string>("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 3306),
        username: config.get<string>("DB_USER", "guzabox"),
        password: config.get<string>("DB_PASSWORD", "pass"),
        database: config.get<string>("DB_NAME", "jazabox"),
        entities: [
          AdminUser,
          OtpCode,
          UssdSession,
          PaymentTransaction,
          PayoutRelease,
          Winner,
          Player,
        ],
        synchronize: config.get<string>("DB_SYNC", "true") === "true",
        logging: config.get<string>("DB_LOGGING", "false") === "true",
      }),
    }),
    AuthModule,
    UssdModule,
    PaymentsModule,
    PayoutsModule,
    AnalyticsModule,
    AdminModule,
    PlayerModule,
  ],
})
export class AppModule {}
