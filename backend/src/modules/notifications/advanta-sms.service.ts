import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

export interface SmsPayload {
  to: string;
  message: string;
}

export interface AdvantaSmsResponse {
  status: string;
  message?: string;
  messageId?: string;
}

@Injectable()
export class AdvantaSmsService {
  private readonly baseUrl: string;
  private readonly partnerId: string;
  private readonly apiKey: string;
  private readonly shortcode: string;
  private readonly sendPath: string;
  private readonly sendUrlOverride: string;

  constructor(private readonly configService: ConfigService) {
    // Support both ADVENTA_* and ADVANTA_* keys; ADVANTA_* is the preferred spelling.
    const get = (primary: string, secondary: string, fallback = "") =>
      this.configService.get<string>(primary) ||
      this.configService.get<string>(secondary) ||
      fallback;

    this.baseUrl = get(
      "ADVENTA_BASE_URL",
      "ADVANTA_BASE_URL",
      "https://developers.advantasms.com/sms-api"
    );
    this.partnerId = get("ADVENTA_PARTNER_ID", "ADVANTA_PARTNER_ID");
    this.apiKey = get("ADVENTA_API_KEY", "ADVANTA_API_KEY");
    this.shortcode = get("ADVENTA_SHORTCODE", "ADVANTA_SHORTCODE");
    this.sendPath = get("ADVENTA_SEND_PATH", "ADVANTA_SEND_PATH", "/send");
    this.sendUrlOverride = get("ADVENTA_SEND_URL", "ADVANTA_SEND_URL");
  }

  async send(payload: SmsPayload): Promise<AdvantaSmsResponse> {
    try {
      if (!this.partnerId || !this.apiKey || !this.shortcode) {
        return {
          status: "failed",
          message: "Advanta SMS credentials are not configured",
        };
      }

      const sendUrl = this.resolveSendUrl();
      const requestData = this.buildRequestData(sendUrl, payload);

      console.log(
        "Sending SMS via Advanta",
        JSON.stringify(
          {
            baseUrl: this.baseUrl,
            url: sendUrl,
            sendPath: this.sendPath,
            sendUrlOverride: this.sendUrlOverride ? "[set]" : "",
            partnerId: this.partnerId,
            shortcode: this.shortcode,
            mobile: requestData.mobile,
            messageLength: payload.message.length,
          },
          null,
          2
        )
      );

      const response = await axios.post(
        sendUrl,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LuckyBox/1.0',
          },
          timeout: 10000, // 10 second timeout
        }
      );

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
        status: 'failed',
        message: error.response?.data?.message || error.message || 'SMS service unavailable',
      };
    }
  }

  private normalizeProviderResult(result: any): AdvantaSmsResponse {
    // Format A (some gateways):
    // { status: "success", messageId: "..." }
    const rawStatus = typeof result?.status === "string" ? result.status : "";
    const normalizedStatus = rawStatus.toLowerCase().trim();
    if (["success", "ok", "sent"].includes(normalizedStatus)) {
      const messageId =
        typeof result?.messageId === "string"
          ? result.messageId
          : typeof result?.messageid === "string"
            ? result.messageid
            : undefined;
      return { status: "success", messageId };
    }

    // Format B (Advanta OTP endpoint observed):
    // { responses: [ { 'response-code': 200, 'response-description': 'Success', messageid: '...' } ] }
    const first = Array.isArray(result?.responses) ? result.responses[0] : undefined;
    const responseCode = first?.["response-code"] ?? first?.responseCode ?? first?.code;
    const responseDesc =
      first?.["response-description"] ?? first?.responseDescription ?? first?.description;

    const codeNum = typeof responseCode === "number" ? responseCode : Number(responseCode);
    const descStr = typeof responseDesc === "string" ? responseDesc : "";
    const descOk = descStr.toLowerCase().includes("success");
    if (codeNum === 200 && descOk) {
      const messageId =
        typeof first?.messageid === "string"
          ? first.messageid
          : typeof first?.messageId === "string"
            ? first.messageId
            : undefined;
      return { status: "success", messageId };
    }

    // Fall back to a "failed" result with best-effort reason string.
    const message =
      typeof result?.message === "string"
        ? result.message
        : typeof descStr === "string" && descStr
          ? descStr
          : "Unknown error from Advanta SMS";

    return { status: "failed", message };
  }

  private resolveSendUrl() {
    if (this.sendUrlOverride) return this.sendUrlOverride;
    return this.joinUrl(this.baseUrl, this.sendPath || "/send");
  }

  private joinUrl(base: string, path: string) {
    const cleanBase = String(base || "").replace(/\/+$/, "");
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return `${cleanBase}/${cleanPath}`;
  }

  private buildRequestData(sendUrl: string, payload: SmsPayload) {
    const mobile = payload.to.replace(/[^0-9]/g, "");

    // Advanta docs for the OTP/transactional endpoint use:
    // POST https://{{url}}/api/services/sendotp
    // { apikey, partnerID, mobile, message, shortcode }
    // Ref: https://developers.advantasms.com/sms-api/
    if (sendUrl.includes("/api/services/")) {
      return {
        apikey: this.apiKey,
        partnerID: this.partnerId,
        mobile,
        message: payload.message,
        shortcode: this.shortcode,
      };
    }

    // Older/alternate gateways use { partnerId, apiKey, shortcode, mobile, message }.
    return {
      partnerId: this.partnerId,
      apiKey: this.apiKey,
      shortcode: this.shortcode,
      mobile,
      message: payload.message,
    };
  }

  async sendLossNotification(phoneNumber: string, betId: string, boxes: any): Promise<AdvantaSmsResponse> {
    const message = `Almost won. Try again.\n\nYou chose ${boxes.selected}\n\n${this.formatBoxResults(boxes)}\n\nBet: ${betId}\nDial **** to win more.`;
    
    return this.send({
      to: phoneNumber,
      message,
    });
  }

  async sendWinNotification(phoneNumber: string, amount: number, betId: string): Promise<AdvantaSmsResponse> {
    const message = `CONGRATULATIONS! You won Ksh ${amount}!\n\nBet ID: ${betId}\n\nYour prize will be sent to your M-Pesa account shortly.\n\nThank you for playing Lucky Box!`;
    
    return this.send({
      to: phoneNumber,
      message,
    });
  }

  async sendAutoWinNotification(phoneNumber: string, amount: number, betId: string): Promise<AdvantaSmsResponse> {
    const message = `🎉 INSTANT WIN! You won Ksh ${amount}!\n\nBet ID: ${betId}\n\nPrize sent to your M-Pesa immediately.\n\nPlay Lucky Box again for more chances to win!`;
    
    return this.send({
      to: phoneNumber,
      message,
    });
  }

  async sendOtp(phoneNumber: string, code: string): Promise<AdvantaSmsResponse> {
    const message = `Your Lucky Box OTP is ${code}. It expires in 5 minutes.`;
    
    return this.send({
      to: phoneNumber,
      message,
    });
  }

  private formatBoxResults(boxes: any): string {
    let result = '';
    for (let i = 1; i <= 6; i++) {
      const boxValue = boxes[`box${i}`] || 0;
      result += `Box ${i}: ${boxValue}\n`;
    }
    return result.trim();
  }

  async getDeliveryStatus(messageId: string): Promise<AdvantaSmsResponse> {
    try {
      const requestData = {
        partnerId: this.partnerId,
        apiKey: this.apiKey,
        messageId: messageId,
      };

      const response = await axios.post(
        `${this.baseUrl}/delivery-status`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        status: 'success',
        message: response.data,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: error.response?.data?.message || error.message || 'Status check failed',
      };
    }
  }

  async getBalance(): Promise<AdvantaSmsResponse> {
    try {
      const requestData = {
        partnerId: this.partnerId,
        apiKey: this.apiKey,
      };

      const response = await axios.post(
        `${this.baseUrl}/balance`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        status: 'success',
        message: `Current balance: ${response.data.balance || response.data}`,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: error.response?.data?.message || error.message || 'Balance check failed',
      };
    }
  }
}
