import { DataSource } from "typeorm";
import { AdminUser } from "../modules/auth/entities/admin-user.entity";
import { OtpCode } from "../modules/auth/entities/otp-code.entity";
import { UssdSession } from "../modules/ussd/entities/ussd-session.entity";
import { PaymentTransaction } from "../modules/payments/entities/payment-transaction.entity";
import { PayoutRelease } from "../modules/payouts/entities/payout-release.entity";
import { Winner } from "../modules/payouts/entities/winner.entity";
import { Player } from "../modules/player/entities/player.entity";

export const AppDataSource = new DataSource({
  type: "mariadb",
  host: process.env.DB_USERNAME || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USERNAME || "luckyuser",
  password: process.env.DB_PASSWORD || "willrocks",
  database: process.env.DB_NAME || "luckybox",
  entities: [
    AdminUser,
    OtpCode,
    UssdSession,
    PaymentTransaction,
    PayoutRelease,
    Winner,
    Player,
  ],
  synchronize: process.env.DB_SYNC === "true",
  logging: process.env.DB_LOGGING === "true",
});
