import { Body, Controller, Get, Logger, Post, Query } from "@nestjs/common";
import { UssdService } from "./ussd.service";

@Controller("ussd")
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  @Get()
  async handleUssdGet(
    @Query()
    query: {
      SESSIONID?: string;
      MSISDN?: string;
      USSDCODE?: string;
      INPUT?: string;
      sessionId?: string;
      phoneNumber?: string;
      text?: string;
      ussdCode?: string;
    }
  ) {
    const sessionId = query.SESSIONID ?? query.sessionId ?? "";
    const phoneNumber = query.MSISDN ?? query.phoneNumber ?? "";
    const inputRaw = query.INPUT ?? query.text ?? "";
    const normalizedInput = this.normalizeInput(
      inputRaw,
      query.USSDCODE ?? query.ussdCode
    );

    this.logger.log(
      JSON.stringify({
        event: "ussd_request",
        method: "GET",
        sessionId,
        phoneNumber,
        ussdCode: query.USSDCODE ?? query.ussdCode ?? null,
        inputRaw,
        inputNormalized: normalizedInput,
      })
    );

    const response = await this.ussdService.handleRequest(
      sessionId,
      phoneNumber,
      normalizedInput
    );
    
    this.logger.log(
      JSON.stringify({
        event: "ussd_response",
        method: "GET",
        sessionId,
        responsePreview: response.split("\n").slice(0, 3).join(" | "),
      })
    );

    return response;
  }

  @Post()
  async handleUssd(
    @Body()
    body: {
      sessionId?: string;
      phoneNumber?: string;
      text?: string;
      SESSIONID?: string;
      MSISDN?: string;
      USSDCODE?: string;
      INPUT?: string;
    }
  ) {
    const sessionId = body.sessionId ?? body.SESSIONID ?? "";
    const phoneNumber = body.phoneNumber ?? body.MSISDN ?? "";
    const inputRaw = body.text ?? body.INPUT ?? "";
    const normalizedInput = this.normalizeInput(inputRaw, body.USSDCODE);
    
    this.logger.log(
      JSON.stringify({
        event: "ussd_request",
        method: "POST",
        sessionId,
        phoneNumber,
        ussdCode: body.USSDCODE ?? null,
        inputRaw,
        inputNormalized: normalizedInput,
      })
    );

    const response = await this.ussdService.handleRequest(
      sessionId,
      phoneNumber,
      normalizedInput
    );
    
    this.logger.log(
      JSON.stringify({
        event: "ussd_response",
        method: "POST",
        sessionId,
        responsePreview: response.split("\n").slice(0, 3).join(" | "),
      })
    );

    return response;
  }

  private normalizeInput(input?: string, ussdCode?: string) {
    if (!input) return "";
    
    // Handle USSD code input (like *519# or *519*63#)
    if (input.includes("*") || input.includes("#")) {
      const cleanedCode = ussdCode?.replace("*", "").replace("#", "") || "";
      const cleanedInput = input.replace("*", "").replace("#", "");
      
      if (cleanedInput.includes(cleanedCode)) {
        return ""; // Return empty to show menu
      }
    }
    
    // Normalize multi-step input (63*1*1 -> 1)
    let normalizedInput = input.trim();
    if (normalizedInput.includes("*")) {
      const parts = normalizedInput.split("*");
      normalizedInput = parts[parts.length - 1]; // Take last part
    }
    
    return normalizedInput;
  }
}
