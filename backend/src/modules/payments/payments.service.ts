import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { PaymentTransaction } from "./entities/payment-transaction.entity";
import { MpesaTokenService } from "./mpesa-token.service";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    private readonly configService: ConfigService,
    private readonly mpesaTokenService: MpesaTokenService,
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
      transaction.status = "SUCCESS" as any;
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

    transaction.status = (resultCode === "0" ? "SUCCESS" : "FAILED") as any;
    transaction.resultCode = resultCode;
    transaction.resultDesc = resultDesc;
    await this.paymentRepo.save(transaction);

    return { ok: true };
  }
}
