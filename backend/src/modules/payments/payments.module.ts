import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import { MpesaTokenService } from "./mpesa-token.service";
import { PaymentTransaction } from "./entities/payment-transaction.entity";
import { PaymentsController } from "./payments.controller";
import { Winner } from "../payouts/entities/winner.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { UssdSession } from "../ussd/entities/ussd-session.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { InstantWinSettings } from "../admin/entities/instant-win-settings.entity";

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      PaymentTransaction,
      Winner,
      PayoutRelease,
      UssdSession,
      InstantWinSettings,
    ]),
  ],
  providers: [PaymentsService, MpesaTokenService],
  controllers: [PaymentsController],
  exports: [PaymentsService, MpesaTokenService],
})
export class PaymentsModule {}
