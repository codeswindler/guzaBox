import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
