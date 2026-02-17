import { Controller, Get, Query } from "@nestjs/common";
import { PlayerService } from "./player.service";

@Controller("players")
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
  ) {}

  @Get("basket/:phoneNumber")
  async getPlayerBasket(@Query("phoneNumber") phoneNumber: string) {
    const basket = await this.playerService.getPlayerBasket(phoneNumber);
    return basket || { error: "Player not found" };
  }
}
