import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { Player } from "../player/entities/player.entity";
import { PlayerService } from "../player/player.service";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { Winner } from "../payouts/entities/winner.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { SmsService } from "../notifications/sms.service";

@Injectable()
export class AutoWinService {
  constructor(
    private readonly playerService: PlayerService,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(Winner)
    private readonly winnerRepo: Repository<Winner>,
    @InjectRepository(PayoutRelease)
    private readonly releaseRepo: Repository<PayoutRelease>,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
  ) {}

  async processAutoWin(transaction: PaymentTransaction) {
    const autoWinEnabled = this.configService.get<boolean>("AUTO_WIN_ENABLED", false);
    if (!autoWinEnabled || transaction.status !== "PAID") {
      return { won: false, reason: "Auto-win disabled or transaction not paid" };
    }

    // Update player stats first
    const player = await this.playerService.updatePlayerStats(
      transaction.phoneNumber,
      Number(transaction.amount),
      transaction.payerName || undefined
    );

    // Calculate win probability
    const winProbability = this.playerService.calculateWinProbability(player);
    const randomValue = Math.random();
    
    if (randomValue > winProbability) {
      return { won: false, reason: "Did not win probability check", probability: winProbability };
    }

    // Calculate prize amount
    const minAmount = this.configService.get<number>("AUTO_WIN_MIN_AMOUNT", 100);
    const maxAmount = this.configService.get<number>("AUTO_WIN_MAX_AMOUNT", 1000);
    const prizeAmount = this.randomBetween(minAmount, maxAmount);

    // Check daily budget limits
    const canPay = await this.checkDailyBudget(prizeAmount);
    if (!canPay) {
      return { won: false, reason: "Daily budget exceeded", prizeAmount };
    }

    // Process the win
    await this.processWinningPayout(transaction, player, prizeAmount);
    
    return { 
      won: true, 
      prizeAmount, 
      probability: winProbability,
      playerStats: {
        hasWonBefore: player.hasWonBefore,
        transactionCount: player.transactionCount,
        loyaltyScore: player.loyaltyScore,
      }
    };
  }

  private async checkDailyBudget(prizeAmount: number): Promise<boolean> {
    const todayPercentage = this.configService.get<number>("AUTO_WIN_PERCENTAGE", 10);
    const { startToday, startTomorrow } = this.getTodayBounds();

    // Get today's collections
    const collectedResult = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("SUM(tx.amount)", "amount")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.createdAt >= :start", { start: startToday })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .getRawOne();

    const collectedToday = Number(collectedResult?.amount ?? 0);
    const maxPayout = (collectedToday * todayPercentage) / 100;

    // Get today's winnings
    const winningsResult = await this.winnerRepo
      .createQueryBuilder("winner")
      .leftJoin("winner.transaction", "tx")
      .select("SUM(winner.amount)", "amount")
      .where("tx.createdAt >= :start", { start: startToday })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .getRawOne();

    const winningsToday = Number(winningsResult?.amount ?? 0);

    return (winningsToday + prizeAmount) <= maxPayout;
  }

  private async processWinningPayout(
    transaction: PaymentTransaction,
    player: Player,
    prizeAmount: number
  ) {
    // Record player win
    await this.playerService.recordWin(transaction.phoneNumber, prizeAmount);

    // Create winner record
    const winner = await this.winnerRepo.save(
      this.winnerRepo.create({
        transaction,
        amount: prizeAmount,
      })
    );

    // Create or update daily release record
    await this.updateDailyRelease(prizeAmount);

    // Send instant win SMS notification
    try {
      await this.smsService.sendAutoWinNotification(
        transaction.phoneNumber,
        prizeAmount,
        transaction.id
      );
    } catch (smsError) {
      console.error("Failed to send auto-win SMS:", smsError);
      // Don't fail the win if SMS fails
    }

    // TODO: Integrate with M-Pesa B2C for instant payout
    console.log(`AUTO-WIN: Player ${transaction.phoneNumber} won Ksh ${prizeAmount}`);
    
    return winner;
  }

  private async updateDailyRelease(prizeAmount: number) {
    const { startToday, startTomorrow } = this.getTodayBounds();
    
    let release = await this.releaseRepo.findOne({
      where: {
        createdAt: startToday,
      },
    });

    if (!release) {
      release = this.releaseRepo.create({
        percentage: 0, // Will be calculated at end of day
        minWin: this.configService.get<number>("AUTO_WIN_MIN_AMOUNT", 100),
        maxWin: this.configService.get<number>("AUTO_WIN_MAX_AMOUNT", 1000),
        releaseBudget: 0, // Will be calculated at end of day
        totalWinners: 0,
        totalReleased: 0,
        createdBy: "auto-win-system",
      });
    }

    release.totalWinners += 1;
    release.totalReleased += prizeAmount;
    await this.releaseRepo.save(release);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getTodayBounds() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    return { startToday, startTomorrow };
  }

  async getAutoWinStats() {
    const { startToday, startTomorrow } = this.getTodayBounds();
    
    const [collections, winnings, releases] = await Promise.all([
      // Today's collections
      this.paymentRepo
        .createQueryBuilder("tx")
        .select("SUM(tx.amount)", "amount")
        .addSelect("COUNT(*)", "count")
        .where("tx.status = :status", { status: "PAID" })
        .andWhere("tx.createdAt >= :start", { start: startToday })
        .andWhere("tx.createdAt < :end", { end: startTomorrow })
        .getRawOne(),
      
      // Today's auto-wins
      this.winnerRepo
        .createQueryBuilder("winner")
        .leftJoin("winner.transaction", "tx")
        .select("SUM(winner.amount)", "amount")
        .addSelect("COUNT(*)", "count")
        .where("tx.createdAt >= :start", { start: startToday })
        .andWhere("tx.createdAt < :end", { end: startTomorrow })
        .getRawOne(),
      
      // Today's release record
      this.releaseRepo.findOne({
        where: { createdAt: startToday },
      }),
    ]);

    const collectedAmount = Number(collections?.amount ?? 0);
    const collectedCount = Number(collections?.count ?? 0);
    const winningsAmount = Number(winnings?.amount ?? 0);
    const winningsCount = Number(winnings?.count ?? 0);
    
    const percentage = collectedAmount > 0 ? (winningsAmount / collectedAmount) * 100 : 0;
    const targetPercentage = this.configService.get<number>("AUTO_WIN_PERCENTAGE", 10);

    return {
      collections: { amount: collectedAmount, count: collectedCount },
      winnings: { amount: winningsAmount, count: winningsCount },
      percentage,
      targetPercentage,
      budgetRemaining: (collectedAmount * targetPercentage / 100) - winningsAmount,
      release: releases,
    };
  }
}
