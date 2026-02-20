import { DataSource } from "typeorm";
import { AdminUser } from "../modules/auth/entities/admin-user.entity";
import { OtpCode } from "../modules/auth/entities/otp-code.entity";
import { UssdSession } from "../modules/ussd/entities/ussd-session.entity";
import { PaymentTransaction } from "../modules/payments/entities/payment-transaction.entity";
import { PayoutRelease } from "../modules/payouts/entities/payout-release.entity";
import { Winner } from "../modules/payouts/entities/winner.entity";
import { Player } from "../modules/player/entities/player.entity";
import { InstantWinSettings } from "../modules/admin/entities/instant-win-settings.entity";
import { Init1700000000000 } from "../migrations/1700000000000-init";
import { AddPayoutBudget1700000000001 } from "../migrations/1700000000001-add-payout-budget";
import { AddPayerName1700000000002 } from "../migrations/1700000000002-add-payer-name";
import { AddInstantWinSettings1700000000003 } from "../migrations/1700000000003-add-instant-win-settings";
import { AddAccountReference1700000000004 } from "../migrations/1700000000004-add-account-reference";
import { AddAdminSessions1700000000005 } from "../migrations/1700000000005-add-admin-sessions";
import { AdminSession } from "../modules/auth/entities/admin-session.entity";

export const AppDataSource = new DataSource({
  type: "mariadb",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  // Defaults match `docs/setup.md` for a smooth local bootstrap.
  username: process.env.DB_USERNAME || "guzabox",
  password: process.env.DB_PASSWORD || "pass",
  database: process.env.DB_NAME || "jazabox",
  entities: [
    AdminUser,
    OtpCode,
    AdminSession,
    UssdSession,
    PaymentTransaction,
    PayoutRelease,
    Winner,
    Player,
    InstantWinSettings,
  ],
  migrations: [
    Init1700000000000,
    AddPayoutBudget1700000000001,
    AddPayerName1700000000002,
    AddInstantWinSettings1700000000003,
    AddAccountReference1700000000004,
    AddAdminSessions1700000000005,
  ],
  synchronize: process.env.DB_SYNC === "true",
  logging: process.env.DB_LOGGING === "true",
});
