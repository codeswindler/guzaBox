import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "../payments/payments.service";
import { UssdSession } from "./entities/ussd-session.entity";

const MENU_TEXT = `Lucky Box
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
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
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

    // Handle first dial (empty input)
    if (!text || text.trim() === "") {
      return `CON ${MENU_TEXT}`;
    }

    // Handle USSD code input (like *519# or *519*63#)
    if (text.includes("*") || text.includes("#")) {
      const ussdCode = this.configService.get<string>("USSD_CODE", "*519#");
      const cleanedCode = ussdCode.replace("*", "").replace("#", "");
      const cleanedInput = text.replace("*", "").replace("#", "");
      
      // If input contains USSD code patterns, show menu
      if (cleanedInput.includes(cleanedCode) || cleanedInput === "") {
        return `CON ${MENU_TEXT}`;
      }
    }

    // Normalize multi-step input (63*1*1 -> 1)
    let normalizedInput = text.trim();
    if (normalizedInput.includes("*")) {
      const parts = normalizedInput.split("*");
      normalizedInput = parts[parts.length - 1]; // Take last part
    }

    // Special handling for common USSD patterns that should show menu
    if (normalizedInput === "63" || normalizedInput === "519" || normalizedInput === "51963") {
      return `CON ${MENU_TEXT}`;
    }

    if (session.state === "START") {
      const choice = normalizedInput.trim();
      
      // Validate choice (must be 1-6)
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
