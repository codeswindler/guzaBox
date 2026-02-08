import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>
  ) {}

  async getSummary() {
    const total = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("COUNT(*)", "count")
      .addSelect("SUM(tx.amount)", "amount")
      .where("tx.status = :status", { status: "PAID" })
      .getRawOne();

    return {
      paidCount: Number(total?.count ?? 0),
      paidAmount: Number(total?.amount ?? 0),
    };
  }

  async getOverview() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);

    const start7 = new Date(startToday);
    start7.setDate(start7.getDate() - 6);

    const [today, last7, allTime] = await Promise.all([
      this.statusSummary(startToday, startTomorrow),
      this.statusSummary(start7, startTomorrow),
      this.statusSummary(),
    ]);

    return { today, last7, allTime };
  }

  async getTrends(granularity: "daily" | "weekly" | "monthly") {
    if (granularity === "weekly") {
      const rows = await this.paymentRepo
        .createQueryBuilder("tx")
        .select("YEARWEEK(tx.createdAt, 3)", "period")
        .addSelect(
          "SUM(CASE WHEN tx.status = 'PAID' THEN 1 ELSE 0 END)",
          "paidCount"
        )
        .addSelect(
          "SUM(CASE WHEN tx.status = 'PAID' THEN tx.amount ELSE 0 END)",
          "paidAmount"
        )
        .addSelect(
          "SUM(CASE WHEN tx.status = 'PENDING' THEN 1 ELSE 0 END)",
          "pendingCount"
        )
        .addSelect(
          "SUM(CASE WHEN tx.status = 'FAILED' THEN 1 ELSE 0 END)",
          "failedCount"
        )
        .groupBy("YEARWEEK(tx.createdAt, 3)")
        .orderBy("period", "ASC")
        .getRawMany();
      return rows.map((row) => ({
        period: row.period,
        paidCount: Number(row.paidCount ?? 0),
        paidAmount: Number(row.paidAmount ?? 0),
        pendingCount: Number(row.pendingCount ?? 0),
        failedCount: Number(row.failedCount ?? 0),
      }));
    }

    const format =
      granularity === "monthly" ? "DATE_FORMAT(tx.createdAt, '%Y-%m')" : "DATE(tx.createdAt)";

    const rows = await this.paymentRepo
      .createQueryBuilder("tx")
      .select(format, "period")
      .addSelect(
        "SUM(CASE WHEN tx.status = 'PAID' THEN 1 ELSE 0 END)",
        "paidCount"
      )
      .addSelect(
        "SUM(CASE WHEN tx.status = 'PAID' THEN tx.amount ELSE 0 END)",
        "paidAmount"
      )
      .addSelect(
        "SUM(CASE WHEN tx.status = 'PENDING' THEN 1 ELSE 0 END)",
        "pendingCount"
      )
      .addSelect(
        "SUM(CASE WHEN tx.status = 'FAILED' THEN 1 ELSE 0 END)",
        "failedCount"
      )
      .groupBy("period")
      .orderBy("period", "ASC")
      .getRawMany();
    return rows.map((row) => ({
      period: row.period,
      paidCount: Number(row.paidCount ?? 0),
      paidAmount: Number(row.paidAmount ?? 0),
      pendingCount: Number(row.pendingCount ?? 0),
      failedCount: Number(row.failedCount ?? 0),
    }));
  }

  async getDemographics() {
    const rows = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("LEFT(tx.phoneNumber, 6)", "prefix")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(tx.amount)", "amount")
      .where("tx.status = :status", { status: "PAID" })
      .groupBy("prefix")
      .orderBy("count", "DESC")
      .getRawMany();

    return rows.map((row) => ({
      prefix: row.prefix,
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    }));
  }

  private async statusSummary(start?: Date, end?: Date) {
    const qb = this.paymentRepo
      .createQueryBuilder("tx")
      .select(
        "SUM(CASE WHEN tx.status = 'PAID' THEN 1 ELSE 0 END)",
        "paidCount"
      )
      .addSelect(
        "SUM(CASE WHEN tx.status = 'PAID' THEN tx.amount ELSE 0 END)",
        "paidAmount"
      )
      .addSelect(
        "SUM(CASE WHEN tx.status = 'PENDING' THEN 1 ELSE 0 END)",
        "pendingCount"
      )
      .addSelect(
        "SUM(CASE WHEN tx.status = 'FAILED' THEN 1 ELSE 0 END)",
        "failedCount"
      );

    if (start) {
      qb.andWhere("tx.createdAt >= :start", { start });
    }
    if (end) {
      qb.andWhere("tx.createdAt < :end", { end });
    }

    const row = await qb.getRawOne();
    return {
      paidCount: Number(row?.paidCount ?? 0),
      paidAmount: Number(row?.paidAmount ?? 0),
      pendingCount: Number(row?.pendingCount ?? 0),
      failedCount: Number(row?.failedCount ?? 0),
    };
  }
}
