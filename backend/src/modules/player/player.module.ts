import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { NotificationsModule } from "../notifications/notifications.module";
import { Player } from "./entities/player.entity";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { Winner } from "../payouts/entities/winner.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { PlayerService } from "./player.service";

@Module({
  imports: [
    ConfigModule,
    NotificationsModule,
    TypeOrmModule.forFeature([Player, PaymentTransaction, Winner, PayoutRelease]),
  ],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
