import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { PasswordLoginDto } from "./dto/password-login.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("request-otp")
  async requestOtp(@Body() dto: RequestOtpDto) {
    const result = await this.authService.requestOtp(dto.phone, dto.email);
    return {
      message: "OTP sent.",
      ...result,
    };
  }

  @Post("verify-otp")
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.phone, dto.code, req);
  }

  @Post("login")
  async passwordLogin(@Body() dto: PasswordLoginDto, @Req() req: Request) {
    return this.authService.loginWithPassword(dto.identifier, dto.password, req);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: Request & { user?: { id: string } }) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new Error("User not found in request");
    }
    const sessions = await this.authService.getActiveSessions(adminId);
    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: JSON.parse(session.deviceInfo),
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
    }));
  }

  @Delete("sessions/:sessionId")
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @Req() req: Request & { user?: { id: string } }
  ) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new Error("User not found in request");
    }
    await this.authService.revokeSession(sessionId, adminId);
    return { message: "Session revoked" };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request & { user?: { id: string } }) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new Error("User not found in request");
    }
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const tokenHash = require("crypto")
        .createHash("sha256")
        .update(token)
        .digest("hex");
      const session = await this.authService.getSessionByTokenHash(tokenHash);
      if (session && session.adminId === adminId) {
        await this.authService.revokeSession(session.id, adminId);
      }
    }
    return { message: "Logged out" };
  }
}
