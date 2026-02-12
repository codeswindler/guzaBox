import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentTransaction } from "./entities/payment-transaction.entity";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>
  ) {}

  @Post("mpesa/callback")
  async mpesaCallback(@Body() payload: any) {
    return this.paymentsService.handleMpesaCallback(payload);
  }

  @Get("transactions")
  async listTransactions(
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    await this.paymentsService.markStalePendingTransactions();
    const qb = this.paymentRepo.createQueryBuilder("tx").orderBy("tx.createdAt", "DESC");

    if (status) {
      qb.andWhere("tx.status = :status", { status });
    }
    if (from) {
      qb.andWhere("tx.createdAt >= :from", { from });
    }
    if (to) {
      qb.andWhere("tx.createdAt <= :to", { to });
    }

    return qb.getMany();
  }

  @Get("kpis")
  async kpis() {
    return {"message": "KPIS not implemented"};
  }

  @Get("leaderboard")
  async leaderboard(@Query("range") range = "daily") {
    const normalized =
      range === "weekly" || range === "monthly" ? range : "daily";
    return {"message": "Leaderboard not implemented"};
  }
}
