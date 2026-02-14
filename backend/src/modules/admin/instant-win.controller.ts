import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { Winner } from "../payouts/entities/winner.entity";
import { PaymentsService } from "../payments/payments.service";
import { InstantWinSettings } from "./entities/instant-win-settings.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("admin")
export class InstantWinController {
  constructor(
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService,
    @InjectRepository(PaymentTransaction)
    private paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(Winner)
    private winnerRepo: Repository<Winner>,
    @InjectRepository(InstantWinSettings)
    private settingsRepo: Repository<InstantWinSettings>,
  ) {}

  @Get("instant-win/status")
  async getInstantWinStatus() {
    const settings = await this.getSettings();
    const instantWinEnabled = settings.enabled;
    const instantWinPercentage = settings.maxPercentage;
    const instantWinMinAmount = settings.minAmount;
    const instantWinMaxAmount = settings.maxAmount;
    const instantWinBaseProbability = settings.baseProbability;
    const sendWinnerMessages = settings.sendWinnerMessages;
    const loserMessage = settings.loserMessage;

    const { startToday, startTomorrow } = this.getNairobiDayBounds();
    const collectionsRow = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("SUM(tx.amount)", "amount")
      .addSelect("COUNT(*)", "count")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.createdAt >= :start", { start: startToday })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .getRawOne();
    const payoutsRow = await this.winnerRepo
      .createQueryBuilder("winner")
      .select("SUM(winner.amount)", "amount")
      .addSelect("COUNT(*)", "count")
      .where("winner.createdAt >= :start", { start: startToday })
      .andWhere("winner.createdAt < :end", { end: startTomorrow })
      .getRawOne();

    const totalCollected = Number(collectionsRow?.amount ?? 0);
    const paidCount = Number(collectionsRow?.count ?? 0);
    const totalPrizesPaid = Number(payoutsRow?.amount ?? 0);
    const winsCount = Number(payoutsRow?.count ?? 0);
    const prizePoolLimit = (totalCollected * Number(instantWinPercentage || 0)) / 100;
    const remainingBudget = Math.max(prizePoolLimit - totalPrizesPaid, 0);
    const budgetUsagePercentage =
      prizePoolLimit > 0 ? (totalPrizesPaid / prizePoolLimit) * 100 : 0;
    const warnThreshold = Number(
      this.configService.get<number>("INSTANT_WIN_ALERT_THRESHOLD", 90)
    );
    const criticalThreshold = Number(
      this.configService.get<number>("INSTANT_WIN_CRITICAL_THRESHOLD", 98)
    );
    const roundedUsage = Math.round(budgetUsagePercentage * 10) / 10;
    const anomaly = this.buildAnomaly(
      roundedUsage,
      remainingBudget,
      warnThreshold,
      criticalThreshold
    );

    return {
      enabled: Boolean(instantWinEnabled),
      config: {
        instantWinEnabled,
        instantWinPercentage,
        instantWinMinAmount,
        instantWinMaxAmount,
        instantWinBaseProbability,
        sendWinnerMessages,
        loserMessage,
      },
      settings: {
        baseProbability: Number(instantWinBaseProbability || 0),
        maxPercentage: Number(instantWinPercentage || 0),
        minAmount: Number(instantWinMinAmount || 0),
        maxAmount: Number(instantWinMaxAmount || 0),
        loserMessage,
        sendWinnerMessages,
      },
      todayStats: {
        totalCollected,
        paidCount,
        totalPrizesPaid,
        prizePoolLimit,
        remainingBudget,
        currentProbability: Number(instantWinBaseProbability || 0),
        budgetUsagePercentage: roundedUsage,
        winsCount,
      },
      anomaly,
      status: "operational",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("instant-win/toggle")
  async toggleInstantWin(@Body() body: { enabled?: boolean }) {
    const settings = await this.getSettings();
    settings.enabled = Boolean(body.enabled);
    await this.settingsRepo.save(settings);
    return { success: true, enabled: settings.enabled };
  }

  @Post("instant-win/settings")
  async updateInstantWinSettings(
    @Body()
    body: {
      baseProbability?: number;
      maxPercentage?: number;
      minAmount?: number;
      maxAmount?: number;
      loserMessage?: string;
      sendWinnerMessages?: boolean;
    }
  ) {
    const settings = await this.getSettings();
    const baseProbability = Number(body.baseProbability ?? settings.baseProbability);
    const maxPercentage = Number(body.maxPercentage ?? settings.maxPercentage);
    const minAmount = Number(body.minAmount ?? settings.minAmount);
    const maxAmount = Number(body.maxAmount ?? settings.maxAmount);
    const loserMessage = String(body.loserMessage ?? settings.loserMessage).trim();
    const sendWinnerMessages =
      typeof body.sendWinnerMessages === "boolean"
        ? body.sendWinnerMessages
        : settings.sendWinnerMessages;

    settings.baseProbability = Math.max(0, Math.min(baseProbability, 1));
    settings.maxPercentage = Math.max(0, Math.min(maxPercentage, 90));
    settings.minAmount = Math.max(1, minAmount);
    settings.maxAmount = Math.max(settings.minAmount, maxAmount);
    settings.loserMessage = loserMessage || "Almost won. Try again.";
    settings.sendWinnerMessages = sendWinnerMessages;

    await this.settingsRepo.save(settings);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post("instant-win/test-b2c")
  async testB2c(@Body() body: { phoneNumber?: string; amount?: number }) {
    const phoneNumber = String(body.phoneNumber ?? "").trim();
    const amount = Number(body.amount ?? 0);
    if (!phoneNumber) {
      return { ok: false, message: "phoneNumber is required" };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "amount must be a positive number" };
    }

    // Guardrail: prevent accidental huge payouts during testing.
    if (amount > 20000) {
      return { ok: false, message: "amount too large for test payout (max 20000)" };
    }

    return this.paymentsService.initiateTestB2CPayout({ phoneNumber, amount });
  }

  private getNairobiDayBounds() {
    const now = new Date();
    const tzOffsetMs = 3 * 60 * 60 * 1000; // Africa/Nairobi UTC+3
    const nairobiNow = new Date(now.getTime() + tzOffsetMs);
    const startNairobi = new Date(
      nairobiNow.getFullYear(),
      nairobiNow.getMonth(),
      nairobiNow.getDate(),
      0,
      0,
      0,
      0
    );
    const endNairobi = new Date(startNairobi);
    endNairobi.setDate(endNairobi.getDate() + 1);
    return {
      startToday: new Date(startNairobi.getTime() - tzOffsetMs),
      startTomorrow: new Date(endNairobi.getTime() - tzOffsetMs),
    };
  }

  private async getSettings() {
    const existing = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (existing) return existing;

    const defaults = this.settingsRepo.create({
      id: 1,
      enabled: this.configService.get<boolean>("INSTANT_WIN_ENABLED", false),
      maxPercentage: Number(
        this.configService.get<number>("INSTANT_WIN_PERCENTAGE", 50)
      ),
      minAmount: Number(this.configService.get<number>("INSTANT_WIN_MIN_AMOUNT", 100)),
      maxAmount: Number(this.configService.get<number>("INSTANT_WIN_MAX_AMOUNT", 1000)),
      baseProbability: Number(
        this.configService.get<number>("INSTANT_WIN_BASE_PROBABILITY", 0.1)
      ),
      loserMessage:
        this.configService.get<string>("LOSER_MESSAGE") || "Almost won. Try again.",
      sendWinnerMessages: this.configService.get<boolean>(
        "SEND_WINNER_MESSAGES",
        false
      ),
    });
    return this.settingsRepo.save(defaults);
  }

  private buildAnomaly(
    budgetUsagePercentage: number,
    remainingBudget: number,
    warnThreshold: number,
    criticalThreshold: number
  ) {
    if (remainingBudget <= 0) {
      return {
        active: true,
        level: "critical",
        badge: "Budget Exhausted",
        description:
          "Prize pool is fully consumed. New winners are blocked until more collections come in.",
        checks: [
          "Check incoming paid transactions are still flowing",
          "Lower base probability to slow payout pressure",
          "Increase cap percentage only if margin allows",
        ],
      };
    }

    if (budgetUsagePercentage >= criticalThreshold) {
      return {
        active: true,
        level: "critical",
        badge: "Critical Budget Pressure",
        description: `Prize pool usage is ${budgetUsagePercentage}%, close to cap.`,
        checks: [
          "Reduce base probability immediately",
          "Validate min/max prize amounts are not too high",
          "Monitor winner rate vs expected retention target",
        ],
      };
    }

    if (budgetUsagePercentage >= warnThreshold) {
      return {
        active: true,
        level: "warn",
        badge: "High Budget Usage",
        description: `Prize pool usage is ${budgetUsagePercentage}%, nearing cap.`,
        checks: [
          "Review payout trend every 15 minutes",
          "Prepare to tune probability if traffic spikes",
          "Confirm loser messaging remains clear and engaging",
        ],
      };
    }

    return {
      active: false,
      level: "normal",
      badge: "Healthy",
      description: "Budget usage is within normal operating range.",
      checks: [],
    };
  }
}
