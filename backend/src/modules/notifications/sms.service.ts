import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SmsPayload, SmsProvider } from "./providers/sms-provider";
import { StubSmsProvider } from "./providers/stub-sms.provider";
import { AdvantaSmsService } from "./advanta-sms.service";

@Injectable()
export class SmsService {
  private readonly provider: SmsProvider;

  constructor(private readonly configService: ConfigService) {
    const providerName = configService.get<string>("SMS_PROVIDER", "stub");
    this.provider = this.resolveProvider(providerName);
  }

  async sendOtp(phone: string, code: string) {
    const message = `Your Lucky Box OTP is ${code}. It expires in 5 minutes.`;
    await this.provider.send({ to: phone, message });
  }

  async sendWinNotification(phoneNumber: string, amount: number, betId: string) {
    const message = `CONGRATULATIONS! You won Ksh ${amount}!\n\nBet ID: ${betId}\n\nYour prize will be sent to your M-Pesa account shortly.\n\nThank you for playing Lucky Box!`;
    await this.provider.send({ to: phoneNumber, message });
  }

  async sendLossNotification(
    phoneNumber: string,
    betId: string,
    selectedBox: number,
    boxResults: { [key: number]: number },
    prefixLine?: string
  ) {
    const ussdCode = this.getUssdCode();
    const prefix = String(prefixLine ?? "Almost won. Try again.").trim() || "Almost won. Try again.";
    const message = `${prefix}

You chose ${selectedBox}

${Object.entries(boxResults)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([box, value]) => `Box ${box}: ${value}`)
  .join("\n")}

Bet: ${betId}

Dial ${ussdCode} to win more.`;
    
    await this.provider.send({ to: phoneNumber, message });
  }

  async sendAutoWinNotification(phoneNumber: string, amount: number, betId: string) {
    const message = `🎉 INSTANT WIN! You won Ksh ${amount}!\n\nBet ID: ${betId}\n\nPrize sent to your M-Pesa immediately.\n\nPlay Lucky Box again for more chances to win!`;
    await this.provider.send({ to: phoneNumber, message });
  }

  private getUssdCode() {
    // This is the dial string players use, e.g. *519*63#
    return this.configService.get<string>("USSD_CODE", "*519*63#");
  }

  private formatBoxResults(boxes: any): string {
    let result = '';
    for (let i = 1; i <= 6; i++) {
      const boxValue = boxes[`box${i}`] || 0;
      result += `Box ${i}: ${boxValue}\n`;
    }
    return result.trim();
  }

  async send(payload: SmsPayload) {
    await this.provider.send(payload);
  }

  private resolveProvider(providerName: string): SmsProvider {
    switch (providerName) {
      case "advanta":
        return new AdvantaSmsService(this.configService);
      case "stub":
      default:
        return new StubSmsProvider();
    }
  }
}
