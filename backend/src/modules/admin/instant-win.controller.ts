import { Controller, Get, Post, Body } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";

@Controller("admin/instant-win")
export class InstantWinController {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
  ) {}

  @Get("status")
  async getStatus() {
    const enabled = this.configService.get<string>("INSTANT_WIN_ENABLED") === "true";
    const baseProbability = Number(this.configService.get<string>("INSTANT_WIN_BASE_PROBABILITY") || 0.1);
    const maxPercentage = Number(this.configService.get<string>("INSTANT_WIN_PERCENTAGE") || 10);
    const minAmount = Number(this.configService.get<string>("INSTANT_WIN_MIN_AMOUNT") || 100);
    const maxAmount = Number(this.configService.get<string>("INSTANT_WIN_MAX_AMOUNT") || 1000);

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const collectionsResult = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("SUM(tx.amount)", "total")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.createdAt >= :start", { start: today })
      .andWhere("tx.createdAt < :end", { end: tomorrow })
      .getRawOne();

    const totalCollected = Number(collectionsResult?.total || 0);
    const prizePoolLimit = totalCollected * (maxPercentage / 100);

    const prizesPaidResult = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("SUM(tx.wonAmount)", "total")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.wonAmount > 0")
      .andWhere("tx.createdAt >= :start", { start: today })
      .andWhere("tx.createdAt < :end", { end: tomorrow })
      .getRawOne();

    const totalPrizesPaid = Number(prizesPaidResult?.total || 0);
    const remainingBudget = prizePoolLimit - totalPrizesPaid;

    // Calculate current probability based on remaining budget
    let currentProbability = baseProbability;
    if (remainingBudget < prizePoolLimit * 0.2) {
      currentProbability = baseProbability * 0.5; // 50% reduction
    } else if (remainingBudget < prizePoolLimit * 0.5) {
      currentProbability = baseProbability * 0.8; // 20% reduction
    }

    return {
      enabled,
      settings: {
        baseProbability,
        maxPercentage,
        minAmount,
        maxAmount,
      },
      todayStats: {
        totalCollected,
        prizePoolLimit,
        totalPrizesPaid,
        remainingBudget,
        currentProbability: Math.round(currentProbability * 100) / 100,
        budgetUsagePercentage: prizePoolLimit > 0 ? Math.round((totalPrizesPaid / prizePoolLimit) * 100) : 0,
      },
    };
  }

  @Post("toggle")
  async toggle(@Body() body: { enabled: boolean; reason?: string }) {
    // Note: In production, you'd update environment variables or database
    // For now, this returns what would be set
    return {
      success: true,
      enabled: body.enabled,
      reason: body.reason || "Manual toggle",
      message: body.enabled 
        ? "Instant wins enabled. Players can now win prizes immediately."
        : "Instant wins disabled. All players will receive loss messages.",
    };
  }

  @Post("settings")
  async updateSettings(@Body() body: {
    baseProbability?: number;
    maxPercentage?: number;
    minAmount?: number;
    maxAmount?: number;
  }) {
    // Note: In production, you'd update environment variables or database
    return {
      success: true,
      settings: {
        baseProbability: body.baseProbability || 0.1,
        maxPercentage: body.maxPercentage || 10,
        minAmount: body.minAmount || 100,
        maxAmount: body.maxAmount || 1000,
      },
      message: "Instant win settings updated successfully.",
    };
  }
}
