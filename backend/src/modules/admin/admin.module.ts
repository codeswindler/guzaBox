import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { InstantWinController } from "./instant-win.controller";
import { InstantGratificationController } from "./instant-gratification.controller";
import { InstantGratificationService } from "./instant-gratification.service";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { Winner } from "../payouts/entities/winner.entity";
import { UssdSession } from "../ussd/entities/ussd-session.entity";
import { InstantWinSettings } from "./entities/instant-win-settings.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      PayoutRelease,
      Winner,
      UssdSession,
      InstantWinSettings,
    ]),
  ],
  controllers: [AdminController, InstantWinController, InstantGratificationController],
  providers: [AdminService, InstantGratificationService],
  exports: [AdminService],
})
export class AdminModule {}
