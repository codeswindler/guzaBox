import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { UssdSession } from "../ussd/entities/ussd-session.entity";

@Injectable()
export class InstantGratificationService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(UssdSession)
    private readonly sessionRepo: Repository<UssdSession>,
  ) {}

  // Get instant gratification stats
  async getInstantGratificationStats() {
    const totalGames = await this.sessionRepo.count();
    const totalWins = await this.sessionRepo.count({ where: { state: "WON" } });
    const totalPayouts = await this.transactionRepo
      .createQueryBuilder("transaction")
      .select("SUM(transaction.amount)", "total")
      .where("transaction.status = :status", { status: "SUCCESS" })
      .getRawOne();

    return {
      totalGames,
      totalWins,
      totalPayouts: totalPayouts.total || 0,
      winRate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0,
      averageWinAmount: totalWins > 0 ? (totalPayouts.total || 0) / totalWins : 0,
    };
  }

  // Update win rate
  async updateWinRate(winRate: number) {
    return { success: true, message: `Win rate updated to ${winRate}%` };
  }

  // Set payout limits
  async setPayoutLimits(dailyLimit: number, monthlyLimit: number) {
    return { success: true, dailyLimit, monthlyLimit };
  }

  // Force win for specific user
  async forceWin(phoneNumber: string, amount: number) {
    const session = await this.sessionRepo.findOne({ where: { phoneNumber } });
    if (!session) {
      throw new Error("User session not found");
    }

    const transaction = await this.transactionRepo.save({
      phoneNumber,
      amount,
      status: "SUCCESS",
      type: "INSTANT_WIN",
      reference: `MANUAL_${Date.now()}`,
    });

    session.state = "WON";
    session.wonAmount = amount;
    await this.sessionRepo.save(session);

    return { success: true, transaction };
  }

  // Block user from winning
  async blockUserFromWinning(phoneNumber: string, durationHours: number) {
    return { success: true, message: `User blocked for ${durationHours} hours` };
  }
}
