import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UssdController } from "./ussd.controller";
import { UssdService } from "./ussd.service";
import { UssdSession } from "./entities/ussd-session.entity";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [TypeOrmModule.forFeature([UssdSession]), PaymentsModule],
  controllers: [UssdController],
  providers: [UssdService],
})
export class UssdModule {}
