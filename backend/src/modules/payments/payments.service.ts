import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { createHash } from "crypto";
import { PaymentTransaction } from "./entities/payment-transaction.entity";
import { MpesaTokenService } from "./mpesa-token.service";
import { Winner } from "../payouts/entities/winner.entity";
import { PayoutRelease } from "../payouts/entities/payout-release.entity";
import { UssdSession } from "../ussd/entities/ussd-session.entity";
import { SmsService } from "../notifications/sms.service";
import { InstantWinSettings } from "../admin/entities/instant-win-settings.entity";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paidStatuses = ["PAID", "SUCCESS"];
  private readonly anomalyAlertBuckets = new Map<string, number>();

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(Winner)
    private readonly winnerRepo: Repository<Winner>,
    @InjectRepository(PayoutRelease)
    private readonly releaseRepo: Repository<PayoutRelease>,
    @InjectRepository(UssdSession)
    private readonly sessionRepo: Repository<UssdSession>,
    private readonly configService: ConfigService,
    private readonly mpesaTokenService: MpesaTokenService,
    private readonly smsService: SmsService,
    private readonly dataSource: DataSource,
  ) {}

  private fingerprintSecret(value: string) {
    const v = String(value ?? "");
    if (!v) return "";
    // Non-reversible fingerprint, safe to log for debugging env-loading issues.
    return createHash("sha256").update(v).digest("hex").slice(0, 10);
  }

  async markStalePendingTransactions() {
    const timeoutMinutes = Number(
      this.configService.get<string>("PAYMENT_TIMEOUT_MINUTES") || 15
    );
    if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
      return;
    }
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    await this.paymentRepo
      .createQueryBuilder()
      .update(PaymentTransaction)
      .set({
        status: "FAILED" as any,
        resultCode: "TIMEOUT",
        resultDesc: "Payment request timed out",
      })
      .where("status = :status", { status: "PENDING" })
      .andWhere("createdAt < :cutoff", { cutoff })
      .execute();
  }

  pickStakeAmount(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async createPendingTransaction(input: {
    phoneNumber: string;
    amount: number;
    box: string | null;
    sessionId: string | null;
  }) {
    const entity = this.paymentRepo.create({
      ...input,
      status: "PENDING" as any,
    });
    return this.paymentRepo.save(entity);
  }

  async initiateStkPush(transaction: PaymentTransaction) {
    const mockMode = this.configService.get<string>("MPESA_MOCK_MODE") === "true";
    
    this.logger.log(`Initiating STK push for phone: ${transaction.phoneNumber}, amount: ${transaction.amount}`);
    this.logger.log(`Mock mode: ${mockMode}`);

    if (mockMode) {
      // Mock successful STK push for testing
      this.logger.log('MOCK: Simulating successful STK push');
      
      transaction.checkoutRequestId = `mock_checkout_${Date.now()}`;
      transaction.status = "PAID" as any;
      transaction.resultCode = "0";
      transaction.resultDesc = "Mock successful payment";
      await this.paymentRepo.save(transaction);

      return {
        CheckoutRequestID: transaction.checkoutRequestId,
        ResponseCode: "0",
        ResponseDescription: "Mock Success",
        MerchantRequestID: `mock_merchant_${Date.now()}`
      };
    }

    // Real M-Pesa implementation
    const baseUrl = this.configService.get<string>("MPESA_BASE_URL");
    const shortcode = this.configService.get<string>("MPESA_SHORTCODE");
    const callbackUrl = this.configService.get<string>("MPESA_CALLBACK_URL");
    const passkey = this.configService.get<string>("MPESA_PASSKEY");

    if (!baseUrl || !shortcode || !callbackUrl || !passkey) {
      this.logger.error('STK push credentials missing');
      transaction.status = "FAILED" as any;
      transaction.resultCode = "STK_NOT_CONFIGURED";
      transaction.resultDesc = "STK push credentials missing";
      await this.paymentRepo.save(transaction);
      return { queued: false, mode: "disabled" };
    }

    try {
      const token = await this.mpesaTokenService.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

      const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: transaction.amount,
        PartyA: transaction.phoneNumber,
        PartyB: shortcode,
        PhoneNumber: transaction.phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: transaction.id,
        TransactionDesc: "Lucky Box Stake",
      };

      this.logger.log(`STK push payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await axios.post(
        `${baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      this.logger.log(`STK push response: ${JSON.stringify(response.data, null, 2)}`);

      transaction.checkoutRequestId = response.data?.CheckoutRequestID ?? null;
      await this.paymentRepo.save(transaction);

      return response.data;
    } catch (error: any) {
      this.logger.error(`STK push failed: ${JSON.stringify({
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config?.url
      }, null, 2)}`);

      transaction.status = "FAILED" as any;
      transaction.resultCode = "STK_PUSH_FAILED";
      transaction.resultDesc =
        error?.response?.data?.errorMessage ||
        error?.message ||
        "STK push request failed";
      await this.paymentRepo.save(transaction);
      throw error;
    }
  }

  private getTimestamp(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Check if phone number has exceeded daily payment limit
   * @param phoneNumber Phone number to check
   * @param maxPaymentsPerDay Maximum allowed payments per day (default: 2)
   * @returns true if limit exceeded, false otherwise
   */
  async hasExceededDailyPaymentLimit(
    phoneNumber: string,
    maxPaymentsPerDay: number = 2
  ): Promise<boolean> {
    const { startToday, startTomorrow } = this.getNairobiDayBounds();

    const count = await this.paymentRepo
      .createQueryBuilder("tx")
      .where("tx.phoneNumber = :phoneNumber", { phoneNumber })
      .andWhere("tx.status = :status", { status: "PAID" })
      .andWhere("tx.createdAt >= :start", { start: startToday })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .getCount();

    return count >= maxPaymentsPerDay;
  }

  async handleMpesaCallback(payload: any) {
    const stk = payload?.Body?.stkCallback;
    if (!stk) return { ok: false };

    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = String(stk.ResultCode ?? "");
    const resultDesc = String(stk.ResultDesc ?? "");

    const outcome = await this.dataSource.transaction(
      "SERIALIZABLE",
      async (manager) => {
        const transaction = await manager
          .getRepository(PaymentTransaction)
          .createQueryBuilder("tx")
          .setLock("pessimistic_write")
          .where("tx.checkoutRequestId = :checkoutRequestId", { checkoutRequestId })
          .getOne();

        if (!transaction) return { ok: false, message: "Transaction not found" };

        if (transaction.status === "PAID" || transaction.status === "FAILED") {
          return {
            ok: true,
            won: Boolean(transaction.wonAmount && Number(transaction.wonAmount) > 0),
            prizeAmount: Number(transaction.wonAmount ?? 0),
            message: "Already processed",
          };
        }

        // Rate limiting: Check if phone number has exceeded daily payment limit
        // This prevents bypassing the limit by directly calling the callback
        const { startToday, startTomorrow } = this.getNairobiDayBounds();
        const paidCount = await manager
          .getRepository(PaymentTransaction)
          .createQueryBuilder("tx")
          .where("tx.phoneNumber = :phoneNumber", { phoneNumber: transaction.phoneNumber })
          .andWhere("tx.status = :status", { status: "PAID" })
          .andWhere("tx.id != :currentId", { currentId: transaction.id })
          .andWhere("tx.createdAt >= :start", { start: startToday })
          .andWhere("tx.createdAt < :end", { end: startTomorrow })
          .getCount();

        if (paidCount >= 2) {
          transaction.status = "FAILED" as any;
          transaction.resultCode = "RATE_LIMIT";
          transaction.resultDesc = "Daily payment limit exceeded";
          await manager.getRepository(PaymentTransaction).save(transaction);
          await this.markSessionLost(manager, transaction.sessionId);
          return { ok: true, won: false, message: "Daily payment limit exceeded" };
        }

        transaction.status = (resultCode === "0" ? "PAID" : "FAILED") as any;
        transaction.resultCode = resultCode;
        transaction.resultDesc = resultDesc;
        await manager.getRepository(PaymentTransaction).save(transaction);

        if (resultCode !== "0") {
          await this.markSessionLost(manager, transaction.sessionId);
          return { ok: true, won: false, message: "Payment failed" };
        }

        const settings = await this.getInstantWinSettings(manager);
        const instantEnabled = settings.enabled;
        if (!instantEnabled) {
          await this.markSessionLost(manager, transaction.sessionId);
          return { ok: true, won: false, message: "Instant wins disabled" };
        }

        const capPercent = Number(settings.maxPercentage);
        const minWin = Number(settings.minAmount);
        const maxWin = Number(settings.maxAmount);
        const baseProbability = Number(settings.baseProbability);

        // Lock release FIRST to prevent race conditions
        // Note: startToday and startTomorrow already declared above for rate limiting check
        const releaseRepo = manager.getRepository(PayoutRelease);
        let release = await releaseRepo
          .createQueryBuilder("release")
          .setLock("pessimistic_write")
          .where("release.createdBy = :createdBy", {
            createdBy: "instant-win-system",
          })
          .andWhere("release.createdAt >= :start", { start: startToday })
          .andWhere("release.createdAt < :end", { end: startTomorrow })
          .getOne();

        // Calculate current collections
        const collectedRow = await manager
          .getRepository(PaymentTransaction)
          .createQueryBuilder("tx")
          .select("SUM(tx.amount)", "amount")
          .where("tx.status = :status", { status: "PAID" })
          .andWhere("tx.createdAt >= :start", { start: startToday })
          .andWhere("tx.createdAt < :end", { end: startTomorrow })
          .getRawOne();
        const collectedToday = Number(collectedRow?.amount ?? 0);
        
        // Calculate new budget based on current collections and percentage
        const newBudget = Math.max(0, (collectedToday * capPercent) / 100);
        
        // Implement protected budget growth (Option A):
        // - Always applies new percentage
        // - Never decreases below what's already been paid
        // - Never decreases below previous budget cap
        // - Allows budget to grow as collections increase
        const totalReleased = Number(release?.totalReleased ?? 0);
        const previousBudget = Number(release?.releaseBudget ?? 0);
        const effectiveBudget = Math.max(newBudget, totalReleased, previousBudget);

        // Use locked release data for remaining budget (faster and more accurate)
        const remainingBudget = Math.max(effectiveBudget - totalReleased, 0);
        
        const canAffordMinimum =
          Number.isFinite(minWin) && minWin > 0 && remainingBudget >= minWin;
        const probabilityPass =
          Number.isFinite(baseProbability) &&
          baseProbability > 0 &&
          Math.random() <= Math.min(Math.max(baseProbability, 0), 1);

        if (!canAffordMinimum || !probabilityPass) {
          await this.markSessionLost(manager, transaction.sessionId);
          return {
            ok: true,
            won: false,
            message: "No win",
            capAmount: effectiveBudget,
            remainingBudget,
          };
        }

        // Add 2 KES safety margin to prevent rounding/race condition edge cases
        const cappedMax = Math.min(maxWin, Math.max(remainingBudget - 2, minWin));
        if (cappedMax < minWin) {
          await this.markSessionLost(manager, transaction.sessionId);
          return {
            ok: true,
            won: false,
            message: "Budget exhausted",
            capAmount: effectiveBudget,
            remainingBudget,
          };
        }

        const prizeAmount = this.randomBetween(minWin, cappedMax);

        // Final safety check: ensure prize doesn't exceed remaining budget
        if (prizeAmount > remainingBudget) {
          this.logger.warn(
            JSON.stringify({
              event: "prize_exceeds_budget",
              prizeAmount,
              remainingBudget,
              cappedMax,
              effectiveBudget,
              totalReleased,
            })
          );
          await this.markSessionLost(manager, transaction.sessionId);
          return {
            ok: true,
            won: false,
            message: "Budget exhausted",
            capAmount: effectiveBudget,
            remainingBudget,
          };
        }

        // Create or update release record
        // Note: SERIALIZABLE isolation level ensures that if two transactions try to create
        // the release simultaneously, one will succeed and the other will retry automatically
        if (!release) {
          release = await releaseRepo.save(
            releaseRepo.create({
              percentage: capPercent,
              minWin,
              maxWin,
              releaseBudget: effectiveBudget,
              totalReleased: 0,
              totalWinners: 0,
              createdBy: "instant-win-system",
            })
          );
        } else {
          release.percentage = capPercent;
          release.minWin = minWin;
          release.maxWin = maxWin;
          release.releaseBudget = effectiveBudget;
        }

        await manager.getRepository(Winner).save(
          manager.getRepository(Winner).create({
            transaction,
            release,
            amount: prizeAmount,
          })
        );

        transaction.wonAmount = prizeAmount;
        transaction.released = true;
        await manager.getRepository(PaymentTransaction).save(transaction);

        release.totalWinners += 1;
        release.totalReleased = Number(release.totalReleased) + prizeAmount;
        await releaseRepo.save(release);

        // Budget overrun monitoring - alert if we exceed effective budget
        if (release.totalReleased > effectiveBudget) {
          this.logger.warn(
            JSON.stringify({
              event: "budget_overrun_detected",
              effectiveBudget,
              totalReleased: release.totalReleased,
              overrun: release.totalReleased - effectiveBudget,
              transactionId: transaction.id,
              phoneNumber: transaction.phoneNumber,
              prizeAmount,
            })
          );
        }

        await this.markSessionWon(manager, transaction.sessionId, prizeAmount);
        const finalRemainingBudget = Math.max(effectiveBudget - release.totalReleased, 0);
        return {
          ok: true,
          won: true,
          prizeAmount,
          capAmount: effectiveBudget,
          remainingBudget: finalRemainingBudget,
          phoneNumber: transaction.phoneNumber,
          transactionId: transaction.id,
        };
      }
    );

    const globalSettings = await this.getInstantWinSettings(this.dataSource.manager);
    this.emitAnomalyAlertIfNeeded(outcome);
    if (
      outcome.ok &&
      outcome.won &&
      outcome.phoneNumber &&
      globalSettings.sendWinnerMessages
    ) {
      try {
        await this.smsService.sendWinNotification(
          outcome.phoneNumber,
          outcome.prizeAmount,
          outcome.transactionId
        );
      } catch (error) {
        this.logger.warn(`Winner SMS failed: ${(error as Error).message}`);
      }
    } else if (outcome.ok && outcome.won === false) {
      const loserMessage =
        globalSettings.loserMessage || "Almost won. Try again.";
    const transaction = await this.paymentRepo.findOne({
      where: { checkoutRequestId },
    });
      if (transaction?.phoneNumber) {
        try {
          // Prefer the richer "game style" loser SMS (chosen box + box results + betId),
          // falling back to the configured loserMessage if we can't resolve session context.
          const sent = await this.trySendLossSmsWithBoxResults(
            transaction,
            loserMessage
          );
          if (!sent) {
            await this.smsService.send({
              to: transaction.phoneNumber,
              message: loserMessage,
            });
          }
        } catch (error) {
          this.logger.warn(`Loser SMS failed: ${(error as Error).message}`);
        }
      }
    }

    if (outcome.ok && outcome.won && outcome.phoneNumber) {
      try {
        await this.initiateB2CPayout({
          phoneNumber: outcome.phoneNumber,
          amount: Number(outcome.prizeAmount),
          reference: outcome.transactionId,
        });
      } catch (error) {
        this.logger.error(
          `B2C payout initiation failed: ${(error as Error).message}`
        );
      }
    }

    return outcome;
  }

  async handleMpesaB2cResult(payload: any) {
    this.logger.log(
      JSON.stringify({
        event: "mpesa_b2c_result",
        payload,
      })
    );
    return { ok: true };
  }

  async handleMpesaB2cTimeout(payload: any) {
    this.logger.warn(
      JSON.stringify({
        event: "mpesa_b2c_timeout",
        payload,
      })
    );
    return { ok: true };
  }

  async getKpis() {
    const { startToday, startTomorrow } = this.getNairobiDayBounds();
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    const startLast7 = new Date(startToday);
    startLast7.setDate(startLast7.getDate() - 6);
    const startPrev7 = new Date(startLast7);
    startPrev7.setDate(startPrev7.getDate() - 7);

    const startLast30 = new Date(startToday);
    startLast30.setDate(startLast30.getDate() - 29);
    const startPrev30 = new Date(startLast30);
    startPrev30.setDate(startPrev30.getDate() - 30);

    const [today, yesterday, last7, prev7, last30, prev30, allTime] =
      await Promise.all([
        this.countAndSumPaid(startToday, startTomorrow),
        this.countAndSumPaid(startYesterday, startToday),
        this.countAndSumPaid(startLast7, startTomorrow),
        this.countAndSumPaid(startPrev7, startLast7),
        this.countAndSumPaid(startLast30, startTomorrow),
        this.countAndSumPaid(startPrev30, startLast30),
        this.countAndSumPaid(),
      ]);

    return { today, yesterday, last7, prev7, last30, prev30, allTime };
  }

  async getLeaderboard(range: "daily" | "weekly" | "monthly" = "daily") {
    const { startToday, startTomorrow } = this.getNairobiDayBounds();
    const start =
      range === "monthly"
        ? this.shiftDays(startToday, -29)
        : range === "weekly"
        ? this.shiftDays(startToday, -6)
        : startToday;

    const rows = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("tx.phoneNumber", "phoneNumber")
      .addSelect("MAX(tx.payerName)", "payerName")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(tx.amount)", "amount")
      .where("tx.status IN (:...statuses)", { statuses: this.paidStatuses })
      .andWhere("tx.createdAt >= :start", { start })
      .andWhere("tx.createdAt < :end", { end: startTomorrow })
      .groupBy("tx.phoneNumber")
      .orderBy("amount", "DESC")
      .limit(10)
      .getRawMany();

    return rows.map((row) => ({
      phoneNumber: row.phoneNumber,
      payerName: row.payerName || null,
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    }));
  }

  private async markSessionWon(
    manager: DataSource["manager"],
    sessionId: string | null,
    amount: number
  ) {
    if (!sessionId) return;
    const sessionRepo = manager.getRepository(UssdSession);
    const session = await sessionRepo.findOne({ where: { sessionId } });
    if (!session) return;
    session.state = "WON";
    session.wonAmount = amount;
    await sessionRepo.save(session);
  }

  private async markSessionLost(
    manager: DataSource["manager"],
    sessionId: string | null
  ) {
    if (!sessionId) return;
    const sessionRepo = manager.getRepository(UssdSession);
    const session = await sessionRepo.findOne({ where: { sessionId } });
    if (!session) return;
    session.state = "LOST";
    session.wonAmount = null;
    await sessionRepo.save(session);
  }

  private async trySendLossSmsWithBoxResults(
    transaction: PaymentTransaction,
    prefixLine: string
  ) {
    if (!transaction.phoneNumber || !transaction.sessionId) return false;

    const session = await this.sessionRepo.findOne({
      where: { sessionId: transaction.sessionId },
    });
    if (!session?.betId || !session.selectedBox) return false;

    const selectedBoxNum = Number(
      String(session.selectedBox).replace(/[^0-9]/g, "")
    );
    if (!Number.isFinite(selectedBoxNum) || selectedBoxNum < 1) return false;

    const results = this.generateBoxResults({
      selectedBox: selectedBoxNum,
      boxCount: 6,
      forceLose: true,
    });

    await this.smsService.sendLossNotification(
      transaction.phoneNumber,
      session.betId,
      selectedBoxNum,
      results,
      prefixLine
    );
    return true;
  }

  private generateBoxResults(opts: {
    selectedBox: number;
    boxCount: number;
    forceLose: boolean;
  }) {
    const count = Math.max(2, Math.min(opts.boxCount, 20));
    const selected = Math.max(1, Math.min(opts.selectedBox, count));

    const results: { [key: number]: number } = {};

    // Start with all zeros.
    for (let i = 1; i <= count; i++) results[i] = 0;

    const candidateBoxes = Array.from({ length: count }, (_, idx) => idx + 1);
    const shuffled = candidateBoxes.sort(() => Math.random() - 0.5);

    if (opts.forceLose && count >= 6) {
      // 6-box game: randomize 2 or 3 losing boxes (0 values), inclusive of the chosen box.
      // Also ensure the losing boxes are not adjacent to each other.
      const loserTarget = Math.random() < 0.5 ? 2 : 3;
      const loserBoxes = new Set<number>([selected]);

      const isAdjacentToAnyLoser = (box: number) => {
        for (const loser of loserBoxes) {
          if (Math.abs(loser - box) <= 1) return true;
        }
        return false;
      };

      // Candidate boxes in random order; we prefer non-adjacent picks.
      for (const b of shuffled) {
        if (loserBoxes.size >= loserTarget) break;
        if (b === selected) continue;
        if (isAdjacentToAnyLoser(b)) continue;
        loserBoxes.add(b);
      }

      // Fallback (should be rare for 6 boxes): if still short, fill from any non-selected box.
      if (loserBoxes.size < loserTarget) {
        for (const b of shuffled) {
          if (loserBoxes.size >= loserTarget) break;
          if (b === selected) continue;
          loserBoxes.add(b);
        }
      }

      for (let i = 1; i <= count; i++) {
        results[i] = loserBoxes.has(i) ? 0 : this.randomBetween(50, 9999);
      }
    } else {
      // Generic fallback: ensure at least one winning box. If forceLose, ensure it's not the selected box.
      const winnersTarget = Math.random() > 0.7 ? 2 : 1;
      const winnerBoxes: number[] = [];

      for (const b of shuffled) {
        if (winnerBoxes.length >= winnersTarget) break;
        if (opts.forceLose && b === selected) continue;
        winnerBoxes.push(b);
      }
      if (winnerBoxes.length === 0) {
        winnerBoxes.push(selected === 1 ? 2 : 1);
      }

      for (const b of winnerBoxes) {
        results[b] = this.randomBetween(50, 9999);
      }

      if (opts.forceLose) results[selected] = 0;
    }

    return results;
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

  private randomBetween(min: number, max: number) {
    const safeMin = Math.ceil(min);
    const safeMax = Math.floor(max);
    if (safeMax <= safeMin) return safeMin;
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  private async countAndSumPaid(start?: Date, end?: Date) {
    const qb = this.paymentRepo
      .createQueryBuilder("tx")
      .select("COUNT(*)", "count")
      .addSelect("SUM(tx.amount)", "amount")
      .where("tx.status IN (:...statuses)", { statuses: this.paidStatuses });
    if (start) {
      qb.andWhere("tx.createdAt >= :start", { start });
    }
    if (end) {
      qb.andWhere("tx.createdAt < :end", { end });
    }
    const row = await qb.getRawOne();
    return {
      count: Number(row?.count ?? 0),
      amount: Number(row?.amount ?? 0),
    };
  }

  private shiftDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private emitAnomalyAlertIfNeeded(outcome: any) {
    if (!outcome?.ok) return;
    const capAmount = Number(outcome.capAmount ?? 0);
    const remainingBudget = Number(outcome.remainingBudget ?? 0);
    if (!Number.isFinite(capAmount) || capAmount <= 0) return;

    const used = Math.max(capAmount - remainingBudget, 0);
    const usagePercent = (used / capAmount) * 100;
    const warnThreshold = Number(
      this.configService.get<number>("INSTANT_WIN_ALERT_THRESHOLD", 90)
    );
    const criticalThreshold = Number(
      this.configService.get<number>("INSTANT_WIN_CRITICAL_THRESHOLD", 98)
    );

    const level =
      usagePercent >= criticalThreshold
        ? "critical"
        : usagePercent >= warnThreshold
        ? "warn"
        : null;
    if (!level) return;

    const now = new Date();
    const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${level}`;
    const bucket = Math.floor(usagePercent / 5) * 5;
    const lastBucket = this.anomalyAlertBuckets.get(key) ?? -1;
    if (bucket <= lastBucket) return;

    this.anomalyAlertBuckets.set(key, bucket);
    const message = JSON.stringify({
      event: "instant_win_budget_alert",
      level,
      usagePercent: Math.round(usagePercent * 100) / 100,
      capAmount,
      remainingBudget,
      won: Boolean(outcome.won),
    });
    if (level === "critical") {
      this.logger.error(message);
    } else {
      this.logger.warn(message);
    }
  }

  private async getInstantWinSettings(manager: DataSource["manager"]) {
    const repo = manager.getRepository(InstantWinSettings);
    const existing = await repo.findOne({ where: { id: 1 } });
    if (existing) return existing;

    const defaults = repo.create({
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
    return repo.save(defaults);
  }

  private async initiateB2CPayout(input: {
    phoneNumber: string;
    amount: number;
    reference: string;
  }) {
    const baseUrl = this.configService.get<string>("MPESA_BASE_URL");
    const shortcode =
      this.configService.get<string>("MPESA_B2C_SHORTCODE") ||
      this.configService.get<string>("MPESA_SHORTCODE");
    const initiatorName = this.configService.get<string>("MPESA_B2C_INITIATOR_NAME");
    const securityCredential =
      this.configService.get<string>("MPESA_B2C_SECURITY_CREDENTIAL") ||
      this.configService.get<string>("MPESA_SECURITY_KEY");
    const commandId =
      this.configService.get<string>("MPESA_B2C_COMMAND_ID") ||
      "BusinessPayment";
    const publicBaseUrl = this.configService.get<string>("PUBLIC_BASE_URL");
    const resultUrl =
      this.configService.get<string>("MPESA_B2C_RESULT_URL") ||
      (publicBaseUrl ? `${publicBaseUrl}/payments/mpesa/b2c/result` : "");
    const timeoutUrl =
      this.configService.get<string>("MPESA_B2C_TIMEOUT_URL") ||
      (publicBaseUrl ? `${publicBaseUrl}/payments/mpesa/b2c/timeout` : "");
    const remarks =
      this.configService.get<string>("MPESA_B2C_REMARKS") || "Lucky Box instant payout";
    const occasion = this.configService.get<string>("MPESA_B2C_OCCASION") || "InstantWin";

    if (
      !baseUrl ||
      !shortcode ||
      !initiatorName ||
      !securityCredential ||
      !resultUrl ||
      !timeoutUrl
    ) {
      this.logger.warn(
        "Skipping B2C payout: missing MPESA B2C configuration (baseUrl/shortcode/initiator/securityCredential/resultUrl/timeoutUrl)"
      );
      return { queued: false, reason: "B2C not configured" };
    }

    const token = await this.mpesaTokenService.getAccessToken();
    const payload = {
      // Optional in Daraja, but including it makes correlating callbacks much easier.
      OriginatorConversationID: input.reference,
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandId,
      Amount: Math.round(Number(input.amount)),
      PartyA: shortcode,
      PartyB: this.normalizePhone(input.phoneNumber),
      Remarks: remarks,
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
      Occasion: occasion,
    };

    const response = await axios.post(
      `${baseUrl}/mpesa/b2c/v1/paymentrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    this.logger.log(
      JSON.stringify({
        event: "mpesa_b2c_request_queued",
        reference: input.reference,
        config: {
          baseUrl,
          shortcode,
          initiatorName,
          commandId,
          resultUrl,
          timeoutUrl,
          securityCredentialLen: String(securityCredential || "").length,
          securityCredentialFp: this.fingerprintSecret(securityCredential || ""),
        },
        phoneNumber: this.normalizePhone(input.phoneNumber),
        amount: Math.round(Number(input.amount)),
        response: response.data,
      })
    );

    return response.data;
  }

  async initiateTestB2CPayout(input: { phoneNumber: string; amount: number }) {
    const missing: string[] = [];
    const baseUrl = this.configService.get<string>("MPESA_BASE_URL");
    const shortcode =
      this.configService.get<string>("MPESA_B2C_SHORTCODE") ||
      this.configService.get<string>("MPESA_SHORTCODE");
    const initiatorName = this.configService.get<string>(
      "MPESA_B2C_INITIATOR_NAME"
    );
    const securityCredential =
      this.configService.get<string>("MPESA_B2C_SECURITY_CREDENTIAL") ||
      this.configService.get<string>("MPESA_SECURITY_KEY");
    const commandId =
      this.configService.get<string>("MPESA_B2C_COMMAND_ID") || "BusinessPayment";
    const publicBaseUrl = this.configService.get<string>("PUBLIC_BASE_URL");
    const resultUrl =
      this.configService.get<string>("MPESA_B2C_RESULT_URL") ||
      (publicBaseUrl ? `${publicBaseUrl}/payments/mpesa/b2c/result` : "");
    const timeoutUrl =
      this.configService.get<string>("MPESA_B2C_TIMEOUT_URL") ||
      (publicBaseUrl ? `${publicBaseUrl}/payments/mpesa/b2c/timeout` : "");

    if (!baseUrl) missing.push("MPESA_BASE_URL");
    if (!shortcode) missing.push("MPESA_B2C_SHORTCODE (or MPESA_SHORTCODE)");
    if (!initiatorName) missing.push("MPESA_B2C_INITIATOR_NAME");
    if (!securityCredential)
      missing.push("MPESA_B2C_SECURITY_CREDENTIAL (or MPESA_SECURITY_KEY)");
    if (!resultUrl) missing.push("MPESA_B2C_RESULT_URL (or PUBLIC_BASE_URL)");
    if (!timeoutUrl) missing.push("MPESA_B2C_TIMEOUT_URL (or PUBLIC_BASE_URL)");

    if (missing.length) {
      return {
        ok: false,
        queued: false,
        reason: "B2C not configured",
        missing,
        configUsed: {
          baseUrl,
          shortcode,
          initiatorName,
          commandId,
          publicBaseUrl,
          resultUrl,
          timeoutUrl,
          securityCredentialLen: String(securityCredential || "").length,
          securityCredentialFp: this.fingerprintSecret(securityCredential || ""),
        },
      };
    }

    const reference = `TEST_B2C_${Date.now()}`;
    const response = await this.initiateB2CPayout({
      phoneNumber: input.phoneNumber,
      amount: Number(input.amount),
      reference,
    });

    return {
      ok: true,
      queued: true,
      reference,
      phoneNumber: this.normalizePhone(input.phoneNumber),
      amount: Math.round(Number(input.amount)),
      configUsed: {
        baseUrl,
        shortcode,
        initiatorName,
        commandId,
        publicBaseUrl,
        resultUrl,
        timeoutUrl,
        securityCredentialLen: String(securityCredential || "").length,
        securityCredentialFp: this.fingerprintSecret(securityCredential || ""),
      },
      response,
    };
  }

  private normalizePhone(phone: string) {
    const cleaned = String(phone || "").replace(/\D/g, "");
    if (cleaned.startsWith("254")) return cleaned;
    if (cleaned.startsWith("0")) return `254${cleaned.slice(1)}`;
    return cleaned;
  }
}
