import { Body, Controller, Get, Logger, Post, Query } from "@nestjs/common";
import { UssdService } from "./ussd.service";

@Controller("ussd")
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  private normalizeInput(input?: string, ussdCode?: string) {
    if (!input) return "";
    const cleanedInput = input.trim().replace(/^(\*+)/, "").replace(/#$/, "");
    if (!cleanedInput) return "";
    const inputParts = cleanedInput.split("*").filter(Boolean);
    if (!ussdCode) {
      if (inputParts.length <= 1) return "";
      return inputParts[inputParts.length - 1] ?? "";
    }
    const cleanedCode = ussdCode
      .trim()
      .replace(/^(\*+)/, "")
      .replace(/#$/, "");
    const codeParts = cleanedCode ? cleanedCode.split("*").filter(Boolean) : [];
    const startsWithCode =
      codeParts.length > 0 &&
      inputParts.slice(0, codeParts.length).join("*") === codeParts.join("*");
    const remaining = startsWithCode
      ? inputParts.slice(codeParts.length)
      : inputParts;
    if (remaining.length === 0) return "";
    if (!startsWithCode && remaining.length === 1) return "";
    return remaining[remaining.length - 1] ?? "";
  }

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

  @Post("simulate")
  async simulateUssd(
    @Body()
    body: { sessionId: string; phoneNumber: string; text?: string }
  ) {
    const response = await this.ussdService.handleRequest(
      body.sessionId,
      body.phoneNumber,
      body.text ?? ""
    );

    return { response };
  }
}
