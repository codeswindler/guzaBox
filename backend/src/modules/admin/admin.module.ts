import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { InstantWinController } from "./instant-win.controller";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { Winner } from "../payouts/entities/winner.entity";

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction, PayoutRelease, Winner])],
  controllers: [AdminController, InstantWinController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
