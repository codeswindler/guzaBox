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

  @Post("mpesa/b2c/result")
  async mpesaB2cResult(@Body() payload: any) {
    return this.paymentsService.handleMpesaB2cResult(payload);
  }

  @Post("mpesa/b2c/timeout")
  async mpesaB2cTimeout(@Body() payload: any) {
    return this.paymentsService.handleMpesaB2cTimeout(payload);
  }

  @Get("transactions")
  async listTransactions(
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
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

    // Add pagination with default limit of 50
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    qb.skip(skip).take(limitNum);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get("kpis")
  async kpis() {
    return this.paymentsService.getKpis();
  }

  @Get("leaderboard")
  async leaderboard(@Query("range") range = "daily") {
    const normalized =
      range === "weekly" || range === "monthly" ? range : "daily";
    return this.paymentsService.getLeaderboard(normalized);
  }
}
