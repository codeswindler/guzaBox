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
    const message = `Your Kwachukua Box OTP is ${code}. It expires in 5 minutes.`;
    await this.sendOrThrow({ to: phone, message });
  }

  async sendWinNotification(phoneNumber: string, amount: number, betId: string) {
    const message = `CONGRATULATIONS! You won Ksh ${amount}!\n\nBet ID: ${betId}\n\nYour prize will be sent to your M-Pesa account shortly.\n\nThank you for playing Kwachukua Box!`;
    await this.sendOrThrow({ to: phoneNumber, message });
  }

  async sendLossNotification(
    phoneNumber: string,
    betId: string,
    selectedBox: number,
    boxResults: { [key: number]: number },
    prefixLine?: string
  ) {
    const message = this.buildLossNotificationMessage({
      betId,
      selectedBox,
      boxResults,
      prefixLine,
    });

    await this.sendOrThrow({ to: phoneNumber, message });
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
    await this.sendOrThrow(payload);
  }

  buildLossNotificationMessage(args: {
    betId: string;
    selectedBox: number;
    boxResults: { [key: number]: number };
    prefixLine?: string;
  }) {
    const ussdCode = this.getUssdCode();
    const prefix =
      String(args.prefixLine ?? "Almost won. Try again.").trim() ||
      "Almost won. Try again.";

    return `${prefix}

You chose ${args.selectedBox}

${Object.entries(args.boxResults)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([box, value]) => `Box ${box}: ${value}`)
  .join("\n")}

Bet: ${args.betId}

Dial ${ussdCode} to win more.`;
  }

  private async sendOrThrow(payload: SmsPayload) {
    const result = await this.provider.send(payload);

    // Some providers (stub) return void; treat that as success.
    if (!result || typeof result !== "object") return;

    const status = (result as any).status;
    if (typeof status !== "string") return;

    const normalized = status.toLowerCase().trim();
    if (["success", "ok", "sent"].includes(normalized)) return result;

    const reason =
      typeof (result as any).message === "string" ? (result as any).message : "";
    throw new Error(
      `SMS provider reported failure (status=${status})${reason ? `: ${reason}` : ""}`
    );
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
