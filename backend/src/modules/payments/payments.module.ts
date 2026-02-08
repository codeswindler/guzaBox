import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import { PaymentTransaction } from "./entities/payment-transaction.entity";
import { PaymentsController } from "./payments.controller";

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction])],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
