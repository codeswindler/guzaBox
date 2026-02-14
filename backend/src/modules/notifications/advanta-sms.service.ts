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

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      "ADVENTA_BASE_URL",
      "https://developers.advantasms.com/sms-api"
    );
    this.partnerId = this.configService.get<string>("ADVENTA_PARTNER_ID", "");
    this.apiKey = this.configService.get<string>("ADVENTA_API_KEY", "");
    this.shortcode = this.configService.get<string>("ADVENTA_SHORTCODE", "");
  }

  async send(payload: SmsPayload): Promise<AdvantaSmsResponse> {
    try {
      if (!this.partnerId || !this.apiKey || !this.shortcode) {
        return {
          status: "failed",
          message: "Advanta SMS credentials are not configured",
        };
      }

      const requestData = {
        partnerId: this.partnerId,
        apiKey: this.apiKey,
        shortcode: this.shortcode,
        mobile: payload.to.replace(/[^0-9]/g, ''), // Clean phone number
        message: payload.message,
      };

      console.log(
        "Sending SMS via Advanta",
        JSON.stringify(
          {
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
        `${this.baseUrl}/send`,
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
      
      if (result.status === 'success' || result.status === 'SUCCESS') {
        console.log(`SMS sent successfully to ${payload.to}. Message ID: ${result.messageId}`);
        return {
          status: 'success',
          messageId: result.messageId,
        };
      } else {
        console.error(`SMS sending failed:`, result);
        return {
          status: 'failed',
          message: result.message || 'Unknown error from Advanta SMS',
        };
      }
    } catch (error: any) {
      console.error(`SMS service error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      return {
        status: 'failed',
        message: error.response?.data?.message || error.message || 'SMS service unavailable',
      };
    }
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
