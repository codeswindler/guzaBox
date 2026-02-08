import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { PayoutRelease } from "./entities/payout-release.entity";
import { Winner } from "./entities/winner.entity";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(PayoutRelease)
    private readonly releaseRepo: Repository<PayoutRelease>,
    @InjectRepository(Winner)
    private readonly winnerRepo: Repository<Winner>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>
  ) {}

  async previewRelease(input: {
    minWin: number;
    maxWin: number;
    releaseBudget: number;
    overrides?: { phoneNumber: string; amount: number }[];
  }) {
    if (input.releaseBudget <= 0) {
      throw new BadRequestException("Release budget must be greater than 0.");
    }
    if (input.minWin <= 0 || input.maxWin < input.minWin) {
      throw new BadRequestException("Invalid win range.");
    }

    const { startToday, startTomorrow } = this.getTodayBounds();

    const collectedRow = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("SUM(tx.amount)", "amount")
      .addSelect("COUNT(*)", "count")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.createdAt >= :start", { start: startToday })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .getRawOne();

    const collectedToday = Number(collectedRow?.amount ?? 0);
    const collectedCount = Number(collectedRow?.count ?? 0);

    if (collectedToday <= 0) {
      throw new BadRequestException("No paid transactions for today.");
    }
    if (input.releaseBudget > collectedToday) {
      throw new BadRequestException("Release budget exceeds today's collection.");
    }

    const leaderboard = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("tx.phoneNumber", "phoneNumber")
      .addSelect("MAX(tx.payerName)", "payerName")
      .addSelect("SUM(tx.amount)", "amount")
      .addSelect("COUNT(*)", "count")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.released = :released", { released: false })
      .andWhere("tx.createdAt >= :start", { start: startToday })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .groupBy("tx.phoneNumber")
      .orderBy("amount", "DESC")
      .getRawMany();

    if (leaderboard.length === 0) {
      throw new BadRequestException("No eligible players for today.");
    }

    const overrideMap = new Map(
      (input.overrides ?? []).map((override) => [
        override.phoneNumber,
        override.amount,
      ])
    );

    let remainingBudget = input.releaseBudget;
    const winners = [];

    for (const row of leaderboard) {
      if (remainingBudget < input.minWin) {
        break;
      }

      const requested = overrideMap.get(row.phoneNumber);
      const maxAllowed = Math.min(input.maxWin, remainingBudget);
      const amount =
        requested !== undefined
          ? requested
          : this.randomBetween(input.minWin, maxAllowed);

      if (amount < input.minWin || amount > input.maxWin) {
        throw new BadRequestException(
          `Override for ${row.phoneNumber} is outside allowed range.`
        );
      }
      if (amount > remainingBudget) {
        throw new BadRequestException(
          `Override for ${row.phoneNumber} exceeds remaining budget.`
        );
      }

      winners.push({
        phoneNumber: row.phoneNumber,
        payerName: row.payerName || null,
        totalPaid: Number(row.amount ?? 0),
        count: Number(row.count ?? 0),
        amount,
      });
      remainingBudget -= amount;
    }

    const totalReleased = winners.reduce((sum, row) => sum + row.amount, 0);
    const percentage =
      collectedToday > 0 ? (input.releaseBudget / collectedToday) * 100 : 0;

    return {
      totals: {
        collectedToday,
        collectedCount,
        percentage,
        totalReleased,
        remainingBudget,
      },
      budget: input.releaseBudget,
      minWin: input.minWin,
      maxWin: input.maxWin,
      eligibleCount: leaderboard.length,
      leaderboard: leaderboard.map((row) => ({
        phoneNumber: row.phoneNumber,
        payerName: row.payerName || null,
        totalPaid: Number(row.amount ?? 0),
        count: Number(row.count ?? 0),
      })),
      winners,
    };
  }

  async releaseWinners(input: {
    minWin: number;
    maxWin: number;
    releaseBudget: number;
    overrides?: { phoneNumber: string; amount: number }[];
    adminId?: string;
  }) {
    const preview = await this.previewRelease({
      minWin: input.minWin,
      maxWin: input.maxWin,
      releaseBudget: input.releaseBudget,
      overrides: input.overrides,
    });

    if (preview.winners.length === 0) {
      throw new BadRequestException("No winners fit the current budget.");
    }

    const actualPercentage =
      preview.totals.collectedToday > 0
        ? (preview.totals.totalReleased / preview.totals.collectedToday) * 100
        : 0;

    const release = await this.releaseRepo.save(
      this.releaseRepo.create({
        percentage: actualPercentage,
        minWin: input.minWin,
        maxWin: input.maxWin,
        releaseBudget: input.releaseBudget,
        totalWinners: preview.winners.length,
        totalReleased: preview.totals.totalReleased,
        createdBy: input.adminId ?? null,
      })
    );

    const { startToday, startTomorrow } = this.getTodayBounds();
    const winners: Winner[] = [];

    for (const winner of preview.winners) {
      const transaction = await this.paymentRepo.findOne({
        where: {
          phoneNumber: winner.phoneNumber,
          status: "PAID",
          released: false,
          createdAt: Between(startToday, startTomorrow),
        },
        order: { createdAt: "DESC" },
      });

      if (!transaction) {
        continue;
      }

      await this.paymentRepo
        .createQueryBuilder()
        .update(PaymentTransaction)
        .set({ released: true })
        .where("phoneNumber = :phoneNumber", { phoneNumber: winner.phoneNumber })
        .andWhere("status = :status", { status: "PAID" })
        .andWhere("createdAt >= :start", { start: startToday })
        .andWhere("createdAt < :end", { end: startTomorrow })
        .execute();

      const winnerEntity = await this.winnerRepo.save(
        this.winnerRepo.create({
          transaction,
          release,
          amount: winner.amount,
        })
      );
      winners.push(winnerEntity);
    }

    release.totalWinners = winners.length;
    release.totalReleased = preview.totals.totalReleased;
    await this.releaseRepo.save(release);

    return { release, winners };
  }

  async listReleases() {
    return this.releaseRepo.find({ order: { createdAt: "DESC" } });
  }

  async listWinners() {
    return this.winnerRepo.find({ order: { createdAt: "DESC" } });
  }

  private randomBetween(min: number, max: number) {
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
}
