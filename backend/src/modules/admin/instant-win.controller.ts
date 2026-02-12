import { Controller, Get, Post, Body } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";

@Controller("admin")
export class InstantWinController {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PaymentTransaction)
    private paymentRepo: Repository<PaymentTransaction>,
  ) {}

  @Get("instant-win/status")
  async getInstantWinStatus() {
    const instantWinEnabled = this.configService.get<boolean>("INSTANT_WIN_ENABLED", false);
    const instantWinPercentage = this.configService.get<number>("INSTANT_WIN_PERCENTAGE", 0);
    const instantWinMinAmount = this.configService.get<number>("INSTANT_WIN_MIN_AMOUNT", 0);
    const instantWinMaxAmount = this.configService.get<number>("INSTANT_WIN_MAX_AMOUNT", 0);
    const instantWinBaseProbability = this.configService.get<number>("INSTANT_WIN_BASE_PROBABILITY", 0);
    const sendWinnerMessages = this.configService.get<boolean>("SEND_WINNER_MESSAGES", false);

    return {
      config: {
        instantWinEnabled,
        instantWinPercentage,
        instantWinMinAmount,
        instantWinMaxAmount,
        instantWinBaseProbability,
        sendWinnerMessages,
      },
      status: "operational",
      timestamp: new Date().toISOString(),
    };
  }
}
