import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { Player } from "./entities/player.entity";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { Winner } from "../payouts/entities/winner.entity";

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(Winner)
    private readonly winnerRepo: Repository<Winner>,
    private readonly configService: ConfigService,
  ) {}

  async updatePlayerStats(phoneNumber: string, amount: number, payerName?: string) {
    let player = await this.playerRepo.findOne({ where: { phoneNumber } });
    
    if (!player) {
      player = this.playerRepo.create({
        phoneNumber,
        payerName,
        totalStaked: 0,
        totalWon: 0,
        transactionCount: 0,
        winCount: 0,
        winRate: 0,
        hasWonBefore: false,
        loyaltyScore: 0,
      });
    }

    player.totalStaked += amount;
    player.transactionCount += 1;
    player.lastPlayedAt = new Date();
    
    // Update loyalty score (1 point per 10 Ksh spent)
    player.loyaltyScore = Math.floor(player.totalStaked / 10);
    
    await this.playerRepo.save(player);
    return player;
  }

  async recordWin(phoneNumber: string, amount: number) {
    const player = await this.playerRepo.findOne({ where: { phoneNumber } });
    if (!player) return null;

    player.totalWon += amount;
    player.winCount += 1;
    player.hasWonBefore = true;
    player.lastWinAt = new Date();
    player.winRate = player.winCount / player.transactionCount;
    
    await this.playerRepo.save(player);
    return player;
  }

  async getPlayerBasket(phoneNumber: string) {
    const player = await this.playerRepo.findOne({ where: { phoneNumber } });
    if (!player) return null;

    // Calculate player basket metrics
    const daysSinceLastWin = player.lastWinAt 
      ? Math.floor((Date.now() - player.lastWinAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const recentTransactions = await this.paymentRepo.find({
      where: { phoneNumber },
      order: { createdAt: "DESC" },
      take: 5,
    });

    return {
      player,
      metrics: {
        daysSinceLastWin,
        recentActivity: recentTransactions.length,
        loyaltyTier: this.getLoyaltyTier(player.loyaltyScore),
        isPersistent: player.transactionCount >= 3, // Played 3+ times
        isDueForWin: daysSinceLastWin > 7 && player.transactionCount >= 5,
      },
    };
  }


  private getLoyaltyTier(score: number): string {
    if (score >= 100) return "Gold";
    if (score >= 50) return "Silver";
    if (score >= 20) return "Bronze";
    return "New";
  }

  private getTodayBounds() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    return { startToday, startTomorrow };
  }
}
