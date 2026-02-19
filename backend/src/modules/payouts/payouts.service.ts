import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { PayoutRelease } from "./entities/payout-release.entity";
import { Winner } from "./entities/winner.entity";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { InstantWinSettings } from "../admin/entities/instant-win-settings.entity";

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(PayoutRelease)
    private readonly releaseRepo: Repository<PayoutRelease>,
    @InjectRepository(Winner)
    private readonly winnerRepo: Repository<Winner>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(InstantWinSettings)
    private readonly settingsRepo: Repository<InstantWinSettings>
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

  async listWinners(options: {
    instantOnly?: boolean;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  } = {}) {
    const { instantOnly = false, from, to, page, limit } = options;
    const queryBuilder = this.winnerRepo
      .createQueryBuilder("winner")
      .leftJoinAndSelect("winner.transaction", "transaction")
      .leftJoinAndSelect("winner.release", "release");

    if (instantOnly) {
      queryBuilder.where("release.createdBy = :createdBy", { createdBy: "instant-win-system" });
    }

    if (from) {
      queryBuilder.andWhere("winner.createdAt >= :from", { from });
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere("winner.createdAt <= :to", { to: toDate });
    }

    queryBuilder.orderBy("winner.createdAt", "DESC");

    // If pagination is requested
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);
      const [data, total] = await queryBuilder.getManyAndCount();
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Return all results if no pagination
    const data = await queryBuilder.getMany();
    return {
      data,
      pagination: {
        page: 1,
        limit: data.length,
        total: data.length,
        totalPages: 1,
      },
    };
  }

  async getDailyCollections(options: {
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  } = {}) {
    try {
      const { from, to, page, limit } = options;
      const { startToday } = this.getNairobiDayBounds();
      const todayDateStr = this.formatDateForGrouping(startToday);
      
      // Build query for paid transactions
      const txQueryBuilder = this.paymentRepo
        .createQueryBuilder("tx")
        .where("tx.status = :status", { status: "PAID" });

      // Apply date filters if provided
      if (from) {
        txQueryBuilder.andWhere("tx.createdAt >= :from", { from });
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        txQueryBuilder.andWhere("tx.createdAt <= :to", { to: toDate });
      }

      txQueryBuilder.orderBy("tx.createdAt", "DESC");
      const allTransactions = await txQueryBuilder.getMany();

      // Group transactions by date (Nairobi timezone) in JavaScript
      const dateMap = new Map<string, typeof allTransactions>();
      for (const tx of allTransactions) {
        const nairobiDate = this.formatDateForGrouping(tx.createdAt);
        if (!dateMap.has(nairobiDate)) {
          dateMap.set(nairobiDate, []);
        }
        dateMap.get(nairobiDate)!.push(tx);
      }

      // Get unique dates sorted DESC
      let uniqueDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

      // Apply pagination if requested
      let paginatedDates = uniqueDates;
      let totalPages = 1;
      if (page !== undefined && limit !== undefined) {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        paginatedDates = uniqueDates.slice(startIndex, endIndex);
        totalPages = Math.ceil(uniqueDates.length / limit);
      }

      const collections = [];

      for (const dateStr of paginatedDates) {
        const dateStart = this.getDateBounds(dateStr).start;
        const dateEnd = this.getDateBounds(dateStr).end;

        // Calculate total collected from grouped transactions (more efficient)
        const dayTransactions = dateMap.get(dateStr) || [];
        const totalCollected = dayTransactions.reduce(
          (sum, tx) => sum + Number(tx.amount || 0),
          0
        );

      // Get release for this day (instant-win-system)
      const release = await this.releaseRepo
        .createQueryBuilder("release")
        .where("release.createdBy = :createdBy", { createdBy: "instant-win-system" })
        .andWhere("release.createdAt >= :start", { start: dateStart })
        .andWhere("release.createdAt < :end", { end: dateEnd })
        .orderBy("release.createdAt", "DESC")
        .getOne();

      // Get total released for this day (from instant-win winners)
      const releasedRow = await this.winnerRepo
        .createQueryBuilder("winner")
        .leftJoin("winner.release", "release")
        .select("SUM(winner.amount)", "amount")
        .where("release.createdBy = :createdBy", { createdBy: "instant-win-system" })
        .andWhere("winner.createdAt >= :start", { start: dateStart })
        .andWhere("winner.createdAt < :end", { end: dateEnd })
        .getRawOne();

      const totalReleased = Number(releasedRow?.amount ?? 0);

      // Calculate budget: use release.releaseBudget if exists, otherwise calculate from percentage
      let budget = 0;
      if (release && release.releaseBudget) {
        budget = Number(release.releaseBudget);
      } else {
        // Get current maxPercentage setting
        const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
        const maxPercentage = settings?.maxPercentage ?? 50;
        budget = (totalCollected * maxPercentage) / 100;
      }

      // Calculate percentage of collections paid out
      const percentage = totalCollected > 0 ? (totalReleased / totalCollected) * 100 : 0;
      
      // Calculate amount retained
      const amountRetained = totalCollected - totalReleased;

        collections.push({
          date: dateStr,
          totalCollected,
          budget,
          totalReleased,
          percentage,
          amountRetained,
          isToday: dateStr === todayDateStr,
        });
      }

      // Return with pagination info if pagination was requested
      if (page !== undefined && limit !== undefined) {
        return {
          data: collections,
          pagination: {
            page: page || 1,
            limit: limit || collections.length,
            total: uniqueDates.length,
            totalPages,
          },
        };
      }

      return {
        data: collections,
        pagination: {
          page: 1,
          limit: collections.length,
          total: collections.length,
          totalPages: 1,
        },
      };
    } catch (error) {
      // Return empty array on error rather than throwing
      // This prevents the frontend from showing a generic error
      console.error("Error fetching daily collections:", error);
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 0,
          total: 0,
          totalPages: 0,
        },
      };
    }
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
    const startUtc = new Date(startNairobi.getTime() - tzOffsetMs);
    const endUtc = new Date(endNairobi.getTime() - tzOffsetMs);
    return { startToday: startUtc, startTomorrow: endUtc };
  }

  private formatDateForGrouping(date: Date): string {
    const tzOffsetMs = 3 * 60 * 60 * 1000; // Africa/Nairobi UTC+3
    const nairobiDate = new Date(date.getTime() + tzOffsetMs);
    const year = nairobiDate.getFullYear();
    const month = String(nairobiDate.getMonth() + 1).padStart(2, "0");
    const day = String(nairobiDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getDateBounds(dateStr: string): { start: Date; end: Date } {
    // dateStr is in format YYYY-MM-DD (Nairobi timezone)
    const [year, month, day] = dateStr.split("-").map(Number);
    const tzOffsetMs = 3 * 60 * 60 * 1000; // Africa/Nairobi UTC+3
    
    // Create start of day in Nairobi timezone
    const startNairobi = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endNairobi = new Date(startNairobi);
    endNairobi.setDate(endNairobi.getDate() + 1);
    
    // Convert to UTC
    const startUtc = new Date(startNairobi.getTime() - tzOffsetMs);
    const endUtc = new Date(endNairobi.getTime() - tzOffsetMs);
    
    return { start: startUtc, end: endUtc };
  }
}
