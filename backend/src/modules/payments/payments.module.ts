import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import { MpesaTokenService } from "./mpesa-token.service";
import { PaymentTransaction } from "./entities/payment-transaction.entity";
import { PaymentsController } from "./payments.controller";

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction])],
  providers: [PaymentsService, MpesaTokenService],
  controllers: [PaymentsController],
  exports: [PaymentsService, MpesaTokenService],
})
export class PaymentsModule {}
