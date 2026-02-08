import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SmsPayload, SmsProvider } from "./providers/sms-provider";
import { StubSmsProvider } from "./providers/stub-sms.provider";

@Injectable()
export class SmsService {
  private readonly provider: SmsProvider;

  constructor(private readonly configService: ConfigService) {
    const providerName = configService.get<string>("SMS_PROVIDER", "stub");
    this.provider = this.resolveProvider(providerName);
  }

  async sendOtp(phone: string, code: string) {
    const message = `Your JazaBox OTP is ${code}. It expires in 5 minutes.`;
    await this.provider.send({ to: phone, message });
  }

  async send(payload: SmsPayload) {
    await this.provider.send(payload);
  }

  private resolveProvider(providerName: string): SmsProvider {
    switch (providerName) {
      case "stub":
      default:
        return new StubSmsProvider();
    }
  }
}
