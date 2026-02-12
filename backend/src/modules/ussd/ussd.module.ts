import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UssdController } from "./ussd.controller";
import { UssdService } from "./ussd.service";
import { UssdSession } from "./entities/ussd-session.entity";
import { PaymentsModule } from "../payments/payments.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    TypeOrmModule.forFeature([UssdSession]), 
    PaymentsModule,
    ConfigModule
  ],
  controllers: [UssdController],
  providers: [UssdService],
})
export class UssdModule {}
