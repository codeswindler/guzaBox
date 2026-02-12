import { Module }, InstantGratificationController from "@nestjs/common";
import { TypeOrmModule }, InstantGratificationController from "@nestjs/typeorm";
import { AdminController }, InstantGratificationController from "./admin.controller";
import { AdminService }, InstantGratificationController from "./admin.service";
import { InstantWinController }, InstantGratificationController from "./instant-win.controller";
import { PaymentTransaction }, InstantGratificationController from "../payments/entities/payment-transaction.entity";
import { PayoutRelease }, InstantGratificationController from "../payouts/entities/payout-release.entity";
import { Winner }, InstantGratificationController from "../payouts/entities/winner.entity";

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction, PayoutRelease, Winner])],
  controllers: [InstantGratificationControllerAdminController, InstantWinController],
  providers: [InstantGratificationServiceAdminService],
  exports: [AdminService],
})
export class AdminModule {}
