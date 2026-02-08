import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PayoutRelease } from "./entities/payout-release.entity";
import { Winner } from "./entities/winner.entity";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { PayoutsService } from "./payouts.service";
import { PayoutsController } from "./payouts.controller";

@Module({
  imports: [TypeOrmModule.forFeature([PayoutRelease, Winner, PaymentTransaction])],
  providers: [PayoutsService],
  controllers: [PayoutsController],
})
export class PayoutsModule {}
