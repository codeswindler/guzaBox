import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminModule } from "./modules/admin/admin.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AdminUser } from "./modules/auth/entities/admin-user.entity";
import { OtpCode } from "./modules/auth/entities/otp-code.entity";
import { InstantWinSettings } from "./modules/admin/entities/instant-win-settings.entity";
import { PaymentTransaction } from "./modules/payments/entities/payment-transaction.entity";
import { PaymentsModule } from "./modules/payments/payments.module";
import { Winner } from "./modules/payouts/entities/winner.entity";
import { PayoutRelease } from "./modules/payouts/entities/payout-release.entity";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { Player } from "./modules/player/entities/player.entity";
import { PlayerModule } from "./modules/player/player.module";
import { UssdSession } from "./modules/ussd/entities/ussd-session.entity";
import { UssdModule } from "./modules/ussd/ussd.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mariadb",
        host: config.get<string>("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 3306),
        // Defaults match `docs/setup.md` for a smooth local bootstrap.
        username: config.get<string>("DB_USERNAME", "guzabox"),
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
          InstantWinSettings,
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

