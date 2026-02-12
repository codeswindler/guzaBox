import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { PlayerService } from "./player.service";
import { AutoWinService } from "./auto-win.service";

@Controller("players")
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly autoWinService: AutoWinService,
  ) {}

  @Get("basket/:phoneNumber")
  async getPlayerBasket(@Query("phoneNumber") phoneNumber: string) {
    const basket = await this.playerService.getPlayerBasket(phoneNumber);
    return basket || { error: "Player not found" };
  }

  @Get("stats")
  async getAutoWinStats() {
    return this.autoWinService.getAutoWinStats();
  }

  @Post("test-autowin")
  async testAutoWin(@Body() body: { phoneNumber: string; amount: number }) {
    // For testing auto-win logic
    const mockTransaction = {
      id: "test-" + Date.now(),
      phoneNumber: body.phoneNumber,
      amount: body.amount,
      status: "PAID",
      payerName: "Test Player",
      createdAt: new Date(),
    } as any;

    return this.autoWinService.processAutoWin(mockTransaction);
  }
}
