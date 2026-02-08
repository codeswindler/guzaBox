import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { PaymentTransaction } from "./entities/payment-transaction.entity";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    private readonly configService: ConfigService
  ) {}

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
        status: "FAILED",
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
      status: "PENDING",
    });
    return this.paymentRepo.save(entity);
  }

  async initiateStkPush(transaction: PaymentTransaction) {
    const baseUrl = this.configService.get<string>("MPESA_BASE_URL");
    const shortcode = this.configService.get<string>("MPESA_SHORTCODE");
    const callbackUrl = this.configService.get<string>("MPESA_CALLBACK_URL");
    const passkey = this.configService.get<string>("MPESA_PASSKEY");
    const token = this.configService.get<string>("MPESA_ACCESS_TOKEN");

    if (!baseUrl || !shortcode || !callbackUrl || !passkey || !token) {
      return { queued: true, mode: "stub" };
    }

    const timestamp = this.getTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      "base64"
    );

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Number(transaction.amount),
      PartyA: transaction.phoneNumber,
      PartyB: shortcode,
      PhoneNumber: transaction.phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: transaction.id,
      TransactionDesc: "JazaBox Stake",
    };

    const response = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    transaction.checkoutRequestId =
      response.data?.CheckoutRequestID ?? null;
    await this.paymentRepo.save(transaction);

    return response.data;
  }

  async handleMpesaCallback(payload: any) {
    const stk = payload?.Body?.stkCallback;
    if (!stk) return { ok: false };

    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = String(stk.ResultCode ?? "");
    const resultDesc = String(stk.ResultDesc ?? "");

    const transaction = await this.paymentRepo.findOne({
      where: { checkoutRequestId },
    });
    if (!transaction) return { ok: false };

    transaction.resultCode = resultCode;
    transaction.resultDesc = resultDesc;
    transaction.status = resultCode === "0" ? "PAID" : "FAILED";

    const metadata = stk.CallbackMetadata?.Item ?? [];
    const receipt = metadata.find((item: any) => item.Name === "MpesaReceiptNumber");
    if (receipt?.Value) {
      transaction.mpesaReceipt = String(receipt.Value);
    }
    const payerName = this.extractPayerName(metadata);
    if (payerName) {
      transaction.payerName = payerName;
    }

    await this.paymentRepo.save(transaction);
    return { ok: true };
  }

  async getKpis() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);

    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    const start7 = new Date(startToday);
    start7.setDate(start7.getDate() - 6);
    const startPrev7 = new Date(start7);
    startPrev7.setDate(startPrev7.getDate() - 7);

    const start30 = new Date(startToday);
    start30.setDate(start30.getDate() - 29);
    const startPrev30 = new Date(start30);
    startPrev30.setDate(startPrev30.getDate() - 30);

    const [today, yesterday, last7, prev7, last30, prev30, allTime] =
      await Promise.all([
        this.sumRange(startToday, startTomorrow),
        this.sumRange(startYesterday, startToday),
        this.sumRange(start7, startTomorrow),
        this.sumRange(startPrev7, start7),
        this.sumRange(start30, startTomorrow),
        this.sumRange(startPrev30, start30),
        this.sumRange(),
      ]);

    return {
      today,
      yesterday,
      last7,
      prev7,
      last30,
      prev30,
      allTime,
    };
  }

  async getLeaderboard(range: "daily" | "weekly" | "monthly" = "daily") {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (range === "weekly") {
      start.setDate(start.getDate() - 6);
    } else if (range === "monthly") {
      start.setDate(start.getDate() - 29);
    }
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const rows = await this.paymentRepo
      .createQueryBuilder("tx")
      .select("tx.phoneNumber", "phoneNumber")
      .addSelect("MAX(tx.payerName)", "payerName")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(tx.amount)", "amount")
      .where("tx.status = :status", { status: "PAID" })
      .andWhere("tx.createdAt >= :start", { start })
      .andWhere("tx.createdAt <= :end", { end })
      .groupBy("tx.phoneNumber")
      .orderBy("amount", "DESC")
      .getRawMany();

    return rows.map((row) => ({
      phoneNumber: row.phoneNumber,
      payerName: row.payerName || null,
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    }));
  }

  private getTimestamp() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  private async sumRange(start?: Date, end?: Date) {
    const qb = this.paymentRepo
      .createQueryBuilder("tx")
      .select("COUNT(*)", "count")
      .addSelect("SUM(tx.amount)", "amount")
      .where("tx.status = :status", { status: "PAID" });

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

  private extractPayerName(metadata: any[]) {
    const findValue = (label: string) =>
      metadata.find((item: any) => item.Name === label)?.Value;

    const direct =
      findValue("CustomerName") ||
      findValue("PayerName") ||
      findValue("FullName");
    if (direct) {
      return String(direct).trim();
    }

    const first = findValue("FirstName");
    const middle = findValue("MiddleName");
    const last = findValue("LastName");
    const parts = [first, middle, last]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);

    if (parts.length > 0) {
      return parts.join(" ");
    }

    return null;
  }
}
