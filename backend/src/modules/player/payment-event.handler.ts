import { Injectable } from "@nestjs/common";
import { PaymentTransaction } from "../payments/entities/payment-transaction.entity";
import { AutoWinService } from "./auto-win.service";

@Injectable()
export class PaymentEventHandler {
  constructor(private readonly autoWinService: AutoWinService) {}

  async handlePaymentCompleted(transaction: PaymentTransaction) {
    if (transaction.status === "PAID") {
      try {
        await this.autoWinService.processAutoWin(transaction);
      } catch (error) {
        console.error("Auto-win processing failed:", error);
        // Don't fail the payment callback if auto-win fails
      }
    }
  }
}
