import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { AdminUser } from "../modules/auth/entities/admin-user.entity";
import { OtpCode } from "../modules/auth/entities/otp-code.entity";
import { UssdSession } from "../modules/ussd/entities/ussd-session.entity";
import { PaymentTransaction } from "../modules/payments/entities/payment-transaction.entity";
import { PayoutRelease } from "../modules/payouts/entities/payout-release.entity";
import { Winner } from "../modules/payouts/entities/winner.entity";

config();

export default new DataSource({
  type: "mariadb",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || "guzabox",
  password: process.env.DB_PASSWORD || "pass",
  database: process.env.DB_NAME || "jazabox",
  entities: [AdminUser, OtpCode, UssdSession, PaymentTransaction, PayoutRelease, Winner],
  migrations: ["dist/migrations/*.js"],
  migrationsTableName: "migrations",
  synchronize: false,
});
