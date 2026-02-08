import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { Winner } from "../payouts/entities/winner.entity";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(PayoutRelease)
    private readonly releaseRepo: Repository<PayoutRelease>,
    @InjectRepository(Winner)
    private readonly winnerRepo: Repository<Winner>
  ) {}

  async seedTransactions() {
    const existing = await this.paymentRepo.count();
    let seededTransactions = 0;

    if (existing === 0) {
      const now = Date.now();
      const rows: PaymentTransaction[] = [];
      for (let i = 0; i < 40; i += 1) {
        const amount = 20 + Math.floor(Math.random() * 11);
        const status = Math.random() > 0.2 ? "PAID" : "PENDING";
        const phoneNumber = `2547${Math.floor(10000000 + Math.random() * 89999999)}`;
        const createdAt = new Date(
          now - Math.floor(Math.random() * 30) * 86400000
        );
        rows.push(
          this.paymentRepo.create({
            phoneNumber,
            amount,
            status,
            box: `Box ${1 + Math.floor(Math.random() * 6)}`,
            sessionId: `seed-${i}`,
            createdAt,
            updatedAt: createdAt,
          } as PaymentTransaction)
        );
      }
      await this.paymentRepo.save(rows);
      seededTransactions = rows.length;
    }

    const existingReleases = await this.releaseRepo.count();
    const existingWinners = await this.winnerRepo.count();

    if (existingReleases === 0 && existingWinners === 0) {
      await this.seedPayouts();
    }

    return {
      seeded: seededTransactions,
      message:
        seededTransactions > 0
          ? "Seeded transactions and payouts."
          : "Seed data already present.",
    };
  }

  async simulatePayments(count = 1) {
    const total = Number.isFinite(count) ? Math.max(1, Math.min(count, 5)) : 1;
    const names = [
      "James Kariuki",
      "Amina Ali",
      "Peter Maina",
      "Faith Wambui",
      "Brian Otieno",
      "Mercy Njeri",
    ];
    const rows: PaymentTransaction[] = [];

    for (let i = 0; i < total; i += 1) {
      const amount = 20 + Math.floor(Math.random() * 11);
      const statusRoll = Math.random();
      const status =
        statusRoll > 0.15 ? "PAID" : statusRoll > 0.05 ? "PENDING" : "FAILED";
      const phoneNumber = `2547${Math.floor(10000000 + Math.random() * 89999999)}`;
      const createdAt = new Date();
      rows.push(
        this.paymentRepo.create({
          phoneNumber,
          payerName: names[Math.floor(Math.random() * names.length)],
          amount,
          status,
          box: `Box ${1 + Math.floor(Math.random() * 6)}`,
          sessionId: `sim-${Date.now()}-${i}`,
          createdAt,
          updatedAt: createdAt,
        } as PaymentTransaction)
      );
    }

    await this.paymentRepo.save(rows);
    return { created: rows.length };
  }

  private async seedPayouts() {
    const paidTx = await this.paymentRepo.find({
      where: { status: "PAID" },
      order: { createdAt: "DESC" },
      take: 15,
    });

    if (paidTx.length === 0) return;

    const minWin = 50;
    const maxWin = 200;
    const winnersCount = Math.min(6, paidTx.length);
    const winners = paidTx.slice(0, winnersCount);
    const winnerAmounts = winners.map(
      () => minWin + Math.floor(Math.random() * (maxWin - minWin + 1))
    );
    const totalReleased = winnerAmounts.reduce((sum, val) => sum + val, 0);
    const totalPaid = paidTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const percentage = totalPaid > 0 ? (totalReleased / totalPaid) * 100 : 0;

    const release = await this.releaseRepo.save(
      this.releaseRepo.create({
        percentage,
        minWin,
        maxWin,
        releaseBudget: totalReleased,
        totalReleased,
        totalWinners: winnersCount,
        createdBy: null,
      })
    );

    const winnerEntities = winners.map((transaction, idx) =>
      this.winnerRepo.create({
        transaction,
        release,
        amount: winnerAmounts[idx],
      })
    );
    await this.winnerRepo.save(winnerEntities);

    const winnerIds = winners.map((tx) => tx.id);
    await this.paymentRepo
      .createQueryBuilder()
      .update(PaymentTransaction)
      .set({ released: true })
      .whereInIds(winnerIds)
      .execute();
  }
}
