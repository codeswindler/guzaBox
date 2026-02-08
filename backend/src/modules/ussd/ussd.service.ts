import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UssdSession } from "./entities/ussd-session.entity";
import { PaymentsService } from "../payments/payments.service";

const MENU_TEXT = `JazaBox
Stake Between Ksh. 20 and 30
Chagua Box yako ya Ushindi
1. Box 1
2. Box 2
3. Box 3
4. Box 4
5. Box 5
6. Box 6`;

@Injectable()
export class UssdService {
  constructor(
    @InjectRepository(UssdSession)
    private readonly sessionRepo: Repository<UssdSession>,
    private readonly paymentsService: PaymentsService
  ) {}

  async handleRequest(sessionId: string, phoneNumber: string, text: string) {
    let session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) {
      session = await this.sessionRepo.save(
        this.sessionRepo.create({
          sessionId,
          phoneNumber,
          state: "START",
        })
      );
    }

    if (!text) {
      return `CON ${MENU_TEXT}`;
    }

    if (session.state === "START") {
      const choice = text.trim();
      if (!["1", "2", "3", "4", "5", "6"].includes(choice)) {
        return `CON ${MENU_TEXT}\nInvalid choice. Try again.`;
      }

      session.state = "STK_PENDING";
      session.selectedBox = `Box ${choice}`;
      await this.sessionRepo.save(session);

      const amount = this.paymentsService.pickStakeAmount(20, 30);
      const transaction = await this.paymentsService.createPendingTransaction({
        phoneNumber,
        amount,
        box: session.selectedBox,
        sessionId: session.sessionId,
      });

      session.transactionId = transaction.id;
      await this.sessionRepo.save(session);

      try {
        await this.paymentsService.initiateStkPush(transaction);
        return "END Complete the transaction to get your winning status";
      } catch {
        session.state = "FAILED";
        await this.sessionRepo.save(session);
        return "END Payment request failed. Please try again later.";
      }
    }

    return "END Session in progress. Please wait.";
  }
}
