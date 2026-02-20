import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
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
  async getSessions(
    @Req() req: Request & { user?: { id: string } },
    @Query("securityKey") securityKey?: string
  ) {
    // Verify security page access key (only if configured)
    const expectedKey = this.authService.getSecurityPageKey();
    if (expectedKey) {
      // Key is configured, so it's required
      if (!securityKey || securityKey !== expectedKey) {
        throw new UnauthorizedException("Invalid security page access key");
      }
    }
    // If no key is configured, allow access (for development/testing)

    const adminId = req.user?.id;
    if (!adminId) {
      throw new Error("User not found in request");
    }
    
    try {
      const sessions = await this.authService.getActiveSessions(adminId);
      const now = new Date();
      return sessions.map((session) => {
        const deviceInfo = JSON.parse(session.deviceInfo);
        const createdAt = new Date(session.createdAt);
        const lastActivityAt = new Date(session.lastActivityAt);
        // Calculate uptime (time since session was created)
        const uptimeMs = now.getTime() - createdAt.getTime();
        const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeStr = uptimeHours > 0 
          ? `${uptimeHours}h ${uptimeMinutes}m`
          : `${uptimeMinutes}m`;
        
        return {
          id: session.id,
          deviceInfo,
          ip: deviceInfo.ip,
          userAgent: deviceInfo.userAgent,
          location: deviceInfo.location || null,
          lastActivityAt: session.lastActivityAt,
          createdAt: session.createdAt,
          uptime: uptimeStr,
          uptimeMs,
        };
      });
    } catch (error: any) {
      // If table doesn't exist or other database error, return empty array
      // This allows the page to load even if migration hasn't run yet
      if (error?.message?.includes("doesn't exist") || error?.code === "ER_NO_SUCH_TABLE") {
        return [];
      }
      // Re-throw other errors
      throw error;
    }
  }

  @Delete("sessions/:sessionId")
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @Req() req: Request & { user?: { id: string } },
    @Query("securityKey") securityKey?: string
  ) {
    // Verify security page access key (only if configured)
    const expectedKey = this.authService.getSecurityPageKey();
    if (expectedKey) {
      if (!securityKey || securityKey !== expectedKey) {
        throw new UnauthorizedException("Invalid security page access key");
      }
    }

    const adminId = req.user?.id;
    if (!adminId) {
      throw new Error("User not found in request");
    }
    await this.authService.revokeSession(sessionId, adminId);
    return { message: "Session revoked" };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request & { user?: { id: string } },
    @Query("securityKey") securityKey?: string
  ) {
    // Verify security page access key (only if configured, optional for logout)
    const expectedKey = this.authService.getSecurityPageKey();
    if (expectedKey && securityKey && securityKey !== expectedKey) {
      throw new UnauthorizedException("Invalid security page access key");
    }

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
