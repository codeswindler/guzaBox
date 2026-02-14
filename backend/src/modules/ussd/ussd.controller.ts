import { Body, Controller, Get, Header, Logger, Post, Query } from "@nestjs/common";
import { UssdService } from "./ussd.service";

@Controller("ussd")
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  @Get()
  @Header("Content-Type", "text/plain; charset=utf-8")
  async handleUssdGet(
    @Query()
    query: {
      SESSIONID?: string;
      SESSION_ID?: string;
      MSISDN?: string;
      phone?: string;
      USSDCODE?: string;
      SERVICECODE?: string;
      SERVICE_CODE?: string;
      INPUT?: string;
      sessionId?: string;
      phoneNumber?: string;
      text?: string;
      ussdCode?: string;
      serviceCode?: string;
    }
  ) {
    const sessionId = query.SESSIONID ?? query.SESSION_ID ?? query.sessionId ?? "";
    const phoneNumber = query.MSISDN ?? query.phoneNumber ?? query.phone ?? "";
    const inputRaw = query.INPUT ?? query.text ?? "";
    const normalizedInput = this.normalizeInput(
      inputRaw,
      query.USSDCODE ?? query.ussdCode ?? query.SERVICECODE ?? query.SERVICE_CODE ?? query.serviceCode
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
  @Header("Content-Type", "text/plain; charset=utf-8")
  async handleUssd(
    @Body()
    body: {
      sessionId?: string;
      phoneNumber?: string;
      phone?: string;
      text?: string;
      SESSIONID?: string;
      SESSION_ID?: string;
      MSISDN?: string;
      USSDCODE?: string;
      ussdCode?: string;
      SERVICECODE?: string;
      SERVICE_CODE?: string;
      serviceCode?: string;
      INPUT?: string;
    }
  ) {
    const sessionId = body.sessionId ?? body.SESSIONID ?? body.SESSION_ID ?? "";
    const phoneNumber = body.phoneNumber ?? body.MSISDN ?? body.phone ?? "";
    const inputRaw = body.text ?? body.INPUT ?? "";
    const normalizedInput = this.normalizeInput(
      inputRaw,
      body.USSDCODE ?? body.ussdCode ?? body.SERVICECODE ?? body.SERVICE_CODE ?? body.serviceCode
    );
    
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
      const cleanedCode = ussdCode?.replace(/[*#]/g, "") || "";
      const cleanedInput = input.replace(/[*#]/g, "");
      
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
