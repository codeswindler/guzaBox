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
            requestData: {
              ApiKey: "[REDACTED]",
              ClientId: this.clientId,
              SenderId: this.senderId,
              MessageParameters: requestData.MessageParameters,
            },
          },
          null,
          2
        )
      );

      const response = await axios.post(sendUrl, requestData, {
        headers: {
          "AccessKey": this.accessKey,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      });

      const result = response.data;
      console.log("Onfon Media API raw response:", JSON.stringify(result, null, 2));
      
      const normalized = this.normalizeProviderResult(result);

      if (normalized.status === "success") {
        console.log(
          `SMS sent successfully to ${payload.to}.${normalized.messageId ? ` Message ID: ${normalized.messageId}` : ""}`
        );
        return normalized;
      }

      console.error(`SMS sending failed. Full API response:`, JSON.stringify(result, null, 2));
      return normalized;
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        baseUrl: this.baseUrl,
        url: `${this.baseUrl}/SendBulkSMS`,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
      };
      
      console.error(`SMS service error (Onfon Media):`, JSON.stringify(errorDetails, null, 2));

      // Build error message from response data if available
      let errorMessage = "";
      
      if (error.response?.data) {
        const responseData = error.response.data;
        
        // Check for Onfon's ErrorDescription format
        if (typeof responseData?.ErrorDescription === "string") {
          errorMessage = responseData.ErrorDescription;
        } else if (typeof responseData?.errorDescription === "string") {
          errorMessage = responseData.errorDescription;
        } else if (typeof responseData?.message === "string") {
          errorMessage = responseData.message;
        } else if (typeof responseData?.Message === "string") {
          errorMessage = responseData.Message;
        } else {
          // Include full response if no specific message found
          errorMessage = `API error: ${JSON.stringify(responseData)}`;
        }
        
        // Include error code if available
        if (responseData?.ErrorCode !== undefined) {
          errorMessage = `ErrorCode ${responseData.ErrorCode}: ${errorMessage}`;
        }
      }
      
      // Fallback to axios error message
      if (!errorMessage) {
        errorMessage = error.message || "SMS service unavailable";
      }
      
      // Add HTTP status if available
      if (error.response?.status) {
        errorMessage = `HTTP ${error.response.status}: ${errorMessage}`;
      }

      return {
        status: "failed",
        message: errorMessage,
      };
    }
  }

  private normalizeProviderResult(result: any): OnfonSmsResponse {
    // Onfon Media uses ErrorCode format: ErrorCode 0 = Success
    const errorCode = result?.ErrorCode ?? result?.errorCode;
    
    if (errorCode === 0 || errorCode === "0") {
      // Check for message-level errors in Data array
      // Even if ErrorCode is 0, individual messages can fail
      if (Array.isArray(result?.Data) && result.Data.length > 0) {
        const firstMessage = result.Data[0];
        const messageErrorCode = firstMessage?.MessageErrorCode ?? firstMessage?.messageErrorCode;
        
        // If MessageErrorCode exists and is non-zero, treat as failure
        if (messageErrorCode !== undefined && messageErrorCode !== null && messageErrorCode !== 0 && messageErrorCode !== "0") {
          const messageErrorDescription = firstMessage?.MessageErrorDescription ?? firstMessage?.messageErrorDescription ?? "";
          const errorMessage = messageErrorDescription 
            ? `MessageErrorCode ${messageErrorCode}: ${messageErrorDescription}`
            : `MessageErrorCode ${messageErrorCode}`;
          
          return { status: "failed", message: errorMessage };
        }
        
        // Success - extract message ID from Data array
        const messageId = firstMessage?.MessageId ?? firstMessage?.messageId;
        if (messageId) {
          return { status: "success", messageId };
        }
      }
      
      // Also check for messageId at root level
      const messageId = result?.messageId ?? result?.MessageId;
      if (messageId) {
        return { status: "success", messageId };
      }
      
      // If ErrorCode is 0 but no message ID found, still treat as success
      // (some responses might not include MessageId)
      return { status: "success" };
    }

    // Check for success status in various formats (fallback for other response formats)
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

    // Build error message from Onfon's ErrorDescription or other fields
    // First check Data array for message-level errors
    let errorMessage = "";
    
    if (Array.isArray(result?.Data) && result.Data.length > 0) {
      const firstMessage = result.Data[0];
      const messageErrorDescription = firstMessage?.MessageErrorDescription ?? firstMessage?.messageErrorDescription;
      const messageErrorCode = firstMessage?.MessageErrorCode ?? firstMessage?.messageErrorCode;
      
      if (messageErrorDescription && typeof messageErrorDescription === "string" && messageErrorDescription.trim() && messageErrorDescription !== "null") {
        errorMessage = messageErrorDescription;
        if (messageErrorCode !== undefined && messageErrorCode !== null) {
          errorMessage = `MessageErrorCode ${messageErrorCode}: ${errorMessage}`;
        }
      }
    }
    
    // Fallback to root-level error fields
    if (!errorMessage) {
      if (typeof result?.ErrorDescription === "string" && result.ErrorDescription.trim() && result.ErrorDescription !== "null") {
        errorMessage = result.ErrorDescription;
      } else if (typeof result?.errorDescription === "string" && result.errorDescription.trim() && result.errorDescription !== "null") {
        errorMessage = result.errorDescription;
      } else if (typeof result?.message === "string" && result.message.trim()) {
        errorMessage = result.message;
      } else if (typeof result?.Message === "string" && result.Message.trim()) {
        errorMessage = result.Message;
      } else if (typeof result?.error === "string" && result.error.trim()) {
        errorMessage = result.error;
      } else if (typeof result?.Error === "string" && result.Error.trim()) {
        errorMessage = result.Error;
      } else if (typeof result?.description === "string" && result.description.trim()) {
        errorMessage = result.description;
      }
    }
    
    // Include error code if available
    if (errorCode !== undefined && errorCode !== null) {
      errorMessage = errorMessage 
        ? `ErrorCode ${errorCode}: ${errorMessage}`
        : `ErrorCode ${errorCode}`;
    }
    
    // If still no message, include raw response for debugging
    if (!errorMessage) {
      const rawResponse = JSON.stringify(result);
      errorMessage = `Unknown error from Onfon Media SMS. Raw response: ${rawResponse}`;
    } else {
      // Append raw response for debugging even when we have an error message
      const rawResponse = JSON.stringify(result);
      errorMessage = `${errorMessage} (Raw response: ${rawResponse})`;
    }

    return { status: "failed", message: errorMessage };
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
