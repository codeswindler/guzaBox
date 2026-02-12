import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UssdSession } from "./entities/ussd-session.entity";
import { PaymentsService } from "../payments/payments.service";
import { SmsService } from "../notifications/sms.service";

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
    private readonly smsService: SmsService,
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
      session.betId = this.generateBetId();
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

    // Handle game result display
    if (session.state === "STK_PENDING" && text.toLowerCase().includes("check")) {
      return await this.handleGameResult(session);
    }

    return "END Session in progress. Please wait.";
  }

  private async handleGameResult(session: UssdSession): Promise<string> {
    if (!session.transactionId) {
      return "END No transaction found for this session.";
    }

    // Get transaction status
    const transaction = await this.paymentsService.getTransaction(session.transactionId);
    if (!transaction) {
      return "END Transaction not found. Please contact support.";
    }

    // Generate random box results
    const boxes = this.generateBoxResults();
    
    // Check if player won (matching their selected box)
    const selectedBoxNum = session.selectedBox?.replace("Box ", "") || "1";
    const selectedBoxValue = boxes[`box${selectedBoxNum}`] || 0;
    
    const won = selectedBoxValue > 0; // Non-zero values are winning
    
    if (won) {
      session.state = "WON";
      session.wonAmount = selectedBoxValue;
      await this.sessionRepo.save(session);
      
      // Send win notification
      await this.smsService.sendWinNotification(
        session.phoneNumber,
        selectedBoxValue,
        session.betId || "N/A"
      );
      
      return `END 🎉 CONGRATULATIONS! You won Ksh ${selectedBoxValue}!\n\nPrize will be sent to your M-Pesa account shortly.\n\nBet ID: ${session.betId}\n\nThank you for playing Lucky Box!`;
    } else {
      session.state = "LOST";
      await this.sessionRepo.save(session);
      
      // Send loss notification with all box results
      await this.smsService.sendLossNotification(
        session.phoneNumber,
        session.betId || "N/A",
        parseInt(selectedBoxNum),
        boxes
      );
      
      return `END Better luck next time!\n\n${this.formatBoxResults(boxes)}\n\nBet: ${session.betId}\nDial **** to win more.`;
    }
  }

  private generateBoxResults(): any {
    // Generate random results with one or more winning boxes
    const boxes: any = {};
    
    // Ensure at least one winner
    const winnerCount = Math.random() > 0.7 ? 1 : (Math.random() > 0.5 ? 2 : 1);
    const winningBoxes = this.shuffleArray(["1", "2", "3", "4", "5", "6"]).slice(0, winnerCount);
    
    for (let i = 1; i <= 6; i++) {
      if (winningBoxes.includes(i.toString())) {
        // Winning box: random amount between 100-5000
        boxes[`box${i}`] = Math.floor(Math.random() * 4901) + 100;
      } else {
        // Losing box: 0
        boxes[`box${i}`] = 0;
      }
    }
    
    return boxes;
  }

  private formatBoxResults(boxes: any): string {
    let result = '';
    for (let i = 1; i <= 6; i++) {
      const boxValue = boxes[`box${i}`] || 0;
      result += `Box ${i}: ${boxValue}\n`;
    }
    return result.trim();
  }

  private generateBetId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Z1o${result}`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async checkSessionStatus(sessionId: string): Promise<any> {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) {
      return { error: "Session not found" };
    }

    return {
      sessionId: session.sessionId,
      phoneNumber: session.phoneNumber,
      state: session.state,
      selectedBox: session.selectedBox,
      transactionId: session.transactionId,
      betId: session.betId,
      wonAmount: session.wonAmount,
    };
  }
}
