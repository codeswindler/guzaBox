import { Controller, Get, Post, Body } from "@nestjs/common";
import { InstantGratificationService } from "./instant-gratification.service";

@Controller("admin/instant-gratification")
export class InstantGratificationController {
  constructor(
    private readonly instantGratificationService: InstantGratificationService,
  ) {}

  @Get("stats")
  async getStats() {
    return await this.instantGratificationService.getInstantGratificationStats();
  }

  @Post("win-rate")
  async updateWinRate(@Body("winRate") winRate: number) {
    return await this.instantGratificationService.updateWinRate(winRate);
  }

  @Post("payout-limits")
  async setPayoutLimits(
    @Body("dailyLimit") dailyLimit: number,
    @Body("monthlyLimit") monthlyLimit: number,
  ) {
    return await this.instantGratificationService.setPayoutLimits(dailyLimit, monthlyLimit);
  }

  @Post("force-win")
  async forceWin(
    @Body("phoneNumber") phoneNumber: string,
    @Body("amount") amount: number,
  ) {
    return await this.instantGratificationService.forceWin(phoneNumber, amount);
  }

  @Post("block-user")
  async blockUser(
    @Body("phoneNumber") phoneNumber: string,
    @Body("durationHours") durationHours: number,
  ) {
    return await this.instantGratificationService.blockUserFromWinning(phoneNumber, durationHours);
  }
}
