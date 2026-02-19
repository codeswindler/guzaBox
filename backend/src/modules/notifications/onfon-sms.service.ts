import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { SmsPayload, SmsProvider } from "./providers/sms-provider";

export interface OnfonSmsResponse {
  status: string;
  message?: string;
  messageId?: string;
}

@Injectable()
export class OnfonSmsService implements SmsProvider {
  private readonly baseUrl: string;
  private readonly accessKey: string;
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly senderId: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>(
        "ONFON_BASE_URL",
        "https://api.onfonmedia.co.ke/v1/sms"
      ) || "https://api.onfonmedia.co.ke/v1/sms";
    this.accessKey = this.configService.get<string>("ONFON_ACCESS_KEY") || "";
    this.apiKey = this.configService.get<string>("ONFON_API_KEY") || "";
    this.clientId = this.configService.get<string>("ONFON_CLIENT_ID") || "";
    this.senderId = this.configService.get<string>("ONFON_SENDER_ID") || "";
  }

  async send(payload: SmsPayload): Promise<OnfonSmsResponse> {
    try {
      if (!this.accessKey || !this.apiKey || !this.clientId || !this.senderId) {
        return {
          status: "failed",
          message: "Onfon SMS credentials are not configured",
        };
      }

      const mobile = payload.to.replace(/[^0-9]/g, "");
      const sendUrl = `${this.baseUrl}/SendBulkSMS`;

      const requestData = {
        ApiKey: this.apiKey,
        ClientId: this.clientId,
        SenderId: this.senderId,
        MessageParameters: [
          {
            Number: mobile,
            Text: payload.message,
          },
        ],
      };

      console.log(
        "Sending SMS via Onfon Media",
        JSON.stringify(
          {
            url: sendUrl,
            clientId: this.clientId,
            senderId: this.senderId,
            mobile,
            messageLength: payload.message.length,
          },
          null,
          2
        )
      );

      const response = await axios.post(sendUrl, requestData, {
        headers: {
          "AccessKey": this.accessKey,
          "Content-Type": "application/json",
          "User-Agent": "KwachuaBox/1.0",
        },
        timeout: 10000, // 10 second timeout
      });

      const result = response.data;
      const normalized = this.normalizeProviderResult(result);

      if (normalized.status === "success") {
        console.log(
          `SMS sent successfully to ${payload.to}.${normalized.messageId ? ` Message ID: ${normalized.messageId}` : ""}`
        );
        return normalized;
      }

      console.error(`SMS sending failed:`, result);
      return normalized;
    } catch (error: any) {
      console.error(`SMS service error:`, {
        message: error.message,
        baseUrl: this.baseUrl,
        response: error.response?.data,
        status: error.response?.status,
      });

      return {
        status: "failed",
        message:
          error.response?.data?.message ||
          error.message ||
          "SMS service unavailable",
      };
    }
  }

  private normalizeProviderResult(result: any): OnfonSmsResponse {
    // Check for success status in various formats
    const rawStatus =
      typeof result?.status === "string" ? result.status : "";
    const normalizedStatus = rawStatus.toLowerCase().trim();

    if (["success", "ok", "sent", "accepted"].includes(normalizedStatus)) {
      const messageId =
        typeof result?.messageId === "string"
          ? result.messageId
          : typeof result?.messageid === "string"
            ? result.messageid
            : typeof result?.MessageId === "string"
              ? result.MessageId
              : Array.isArray(result?.MessageParameters) &&
                  result.MessageParameters[0]?.MessageId
                ? result.MessageParameters[0].MessageId
                : undefined;

      return { status: "success", messageId };
    }

    // Check for response code format (e.g., 200, 201)
    const responseCode =
      result?.responseCode ??
      result?.ResponseCode ??
      result?.code ??
      result?.Code;
    const codeNum =
      typeof responseCode === "number"
        ? responseCode
        : Number(responseCode);

    if (codeNum >= 200 && codeNum < 300) {
      const messageId =
        typeof result?.messageId === "string"
          ? result.messageId
          : typeof result?.messageid === "string"
            ? result.messageid
            : undefined;

      return { status: "success", messageId };
    }

    // Fall back to a "failed" result with best-effort reason string
    const message =
      typeof result?.message === "string"
        ? result.message
        : typeof result?.Message === "string"
          ? result.Message
          : typeof result?.error === "string"
            ? result.error
            : typeof result?.Error === "string"
              ? result.Error
              : typeof result?.description === "string"
                ? result.description
                : "Unknown error from Onfon Media SMS";

    return { status: "failed", message };
  }

  async sendLossNotification(
    phoneNumber: string,
    betId: string,
    boxes: any
  ): Promise<OnfonSmsResponse> {
    const message = `Almost won. Try again.\n\nYou chose ${boxes.selected}\n\n${this.formatBoxResults(boxes)}\n\nBet: ${betId}\nDial **** to win more.`;

    return this.send({
      to: phoneNumber,
      message,
    });
  }

  async sendWinNotification(
    phoneNumber: string,
    amount: number,
    betId: string
  ): Promise<OnfonSmsResponse> {
    const message = `CONGRATULATIONS! You won Ksh ${amount}!\n\nBet ID: ${betId}\n\nYour prize will be sent to your M-Pesa account shortly.\n\nThank you for playing Kwachua Box!`;

    return this.send({
      to: phoneNumber,
      message,
    });
  }

  async sendOtp(phoneNumber: string, code: string): Promise<OnfonSmsResponse> {
    const message = `Your Kwachua Box OTP is ${code}. It expires in 5 minutes.`;

    return this.send({
      to: phoneNumber,
      message,
    });
  }

  private formatBoxResults(boxes: any): string {
    let result = "";
    for (let i = 1; i <= 6; i++) {
      const boxValue = boxes[`box${i}`] || 0;
      result += `Box ${i}: ${boxValue}\n`;
    }
    return result.trim();
  }
}
