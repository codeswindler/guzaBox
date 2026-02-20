import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { createHash, randomInt } from "crypto";
import { Request } from "express";
import axios from "axios";
import { AdminUser } from "./entities/admin-user.entity";
import { OtpCode } from "./entities/otp-code.entity";
import { AdminSession } from "./entities/admin-session.entity";
import { SmsService } from "../notifications/sms.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
    @InjectRepository(AdminSession)
    private readonly sessionRepo: Repository<AdminSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService
  ) {}

  async ensureDefaultAdmin() {
    const phone = this.configService.get<string>("ADMIN_PHONE");
    if (!phone) return;
    const existing = await this.adminRepo.findOne({ where: { phone } });
    if (existing) return;

    const email = this.configService.get<string>("ADMIN_EMAIL") ?? null;
    await this.adminRepo.save(
      this.adminRepo.create({
        phone,
        email,
        isActive: true,
      })
    );
  }

  async requestOtp(phone: string, email?: string) {
    const admin = await this.adminRepo.findOne({ where: { phone } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Admin not found or inactive.");
    }
    if (email && admin.email && admin.email !== email) {
      throw new UnauthorizedException("Admin email mismatch.");
    }

    const code = String(randomInt(100000, 999999));
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({ admin, codeHash, expiresAt })
    );

    await this.smsService.sendOtp(phone, code);

    return { code, expiresAt };
  }

  async verifyOtp(phone: string, code: string, req?: Request) {
    const admin = await this.adminRepo.findOne({ where: { phone } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Admin not found or inactive.");
    }

    const codeHash = this.hashCode(code);
    const otp = await this.otpRepo.findOne({
      where: { admin: { id: admin.id }, codeHash, used: false },
      order: { createdAt: "DESC" },
    });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("OTP invalid or expired.");
    }

    otp.used = true;
    await this.otpRepo.save(otp);

    const token = await this.jwtService.signAsync({
      sub: admin.id,
      phone: admin.phone,
    });

    // Create session if device info is available (non-blocking - don't fail login if session creation fails)
    if (req) {
      try {
        const deviceInfo = this.extractDeviceInfo(req);
        await this.createSession(admin.id, token, deviceInfo);
      } catch (error) {
        // Log error but don't fail login - session tracking is optional
        console.error("Failed to create session:", error);
      }
    }

    return { token };
  }

  async loginWithPassword(identifier: string, password: string, req?: Request) {
    const adminPhone = this.configService.get<string>("ADMIN_PHONE") || "";
    const adminEmail = this.configService.get<string>("ADMIN_EMAIL") || "";
    const adminUsername =
      this.configService.get<string>("ADMIN_USERNAME") || "";
    const normalizedIdentifier = identifier.trim();

    let lookupIdentifier = normalizedIdentifier;
    if (
      adminUsername &&
      normalizedIdentifier.toLowerCase() === adminUsername.toLowerCase()
    ) {
      lookupIdentifier = adminPhone || adminEmail || normalizedIdentifier;
    }

    const admin = await this.adminRepo.findOne({
      where: [{ phone: lookupIdentifier }, { email: lookupIdentifier }],
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Admin not found or inactive.");
    }

    const expected = this.configService.get<string>("ADMIN_PASSWORD");
    if (!expected || password !== expected) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const token = await this.jwtService.signAsync({
      sub: admin.id,
      phone: admin.phone,
    });

    // Create session if device info is available (non-blocking - don't fail login if session creation fails)
    if (req) {
      try {
        const deviceInfo = this.extractDeviceInfo(req);
        await this.createSession(admin.id, token, deviceInfo);
      } catch (error) {
        // Log error but don't fail login - session tracking is optional
        console.error("Failed to create session:", error);
      }
    }

    return { token };
  }

  extractDeviceInfo(req: Request): {
    userAgent: string;
    ip: string;
    deviceFingerprint: string;
  } {
    const userAgent = req.headers["user-agent"] || "Unknown";
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip =
      (Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor || req.ip || req.socket.remoteAddress || "Unknown"
      ).split(",")[0]
        .trim();

    // Generate device fingerprint from headers
    const acceptLanguage = req.headers["accept-language"] || "";
    const fingerprintData = `${ip}|${userAgent}|${acceptLanguage}`;
    const deviceFingerprint = createHash("sha256")
      .update(fingerprintData)
      .digest("hex")
      .substring(0, 32);

    return {
      userAgent,
      ip,
      deviceFingerprint,
    };
  }

  async getLocationFromIp(ip: string): Promise<{
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    location?: string;
  } | null> {
    // Skip localhost and private IPs
    if (
      ip === "Unknown" ||
      ip === "127.0.0.1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.16.") ||
      ip.startsWith("172.17.") ||
      ip.startsWith("172.18.") ||
      ip.startsWith("172.19.") ||
      ip.startsWith("172.20.") ||
      ip.startsWith("172.21.") ||
      ip.startsWith("172.22.") ||
      ip.startsWith("172.23.") ||
      ip.startsWith("172.24.") ||
      ip.startsWith("172.25.") ||
      ip.startsWith("172.26.") ||
      ip.startsWith("172.27.") ||
      ip.startsWith("172.28.") ||
      ip.startsWith("172.29.") ||
      ip.startsWith("172.30.") ||
      ip.startsWith("172.31.")
    ) {
      return null;
    }

    try {
      // Use ip-api.com (free, no API key required)
      const response = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 3000, // 3 second timeout
      });

      if (response.data && response.data.status === "success") {
        const data = response.data;
        const locationParts = [];
        if (data.city) locationParts.push(data.city);
        if (data.zip) locationParts.push(data.zip);
        if (data.regionName) locationParts.push(data.regionName);
        if (data.country) locationParts.push(data.country);

        return {
          city: data.city,
          region: data.regionName,
          country: data.country,
          countryCode: data.countryCode,
          zip: data.zip,
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone,
          isp: data.isp,
          location: locationParts.join(", ") || data.country || "Unknown",
        };
      }
    } catch (error: any) {
      // Silently fail - location is optional
      console.error(`Failed to get location for IP ${ip}:`, error?.message || String(error));
    }

    return null;
  }

  async createSession(
    adminId: string,
    token: string,
    deviceInfo: { userAgent: string; ip: string; deviceFingerprint: string }
  ): Promise<AdminSession> {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Fetch location asynchronously (don't block session creation)
    let location = null;
    try {
      location = await this.getLocationFromIp(deviceInfo.ip);
    } catch (error) {
      // Ignore errors - location is optional
    }

    const sessionData: any = {
      adminId,
      tokenHash,
      deviceInfo: JSON.stringify({
        ...deviceInfo,
        location,
      }),
      lastActivityAt: new Date(),
      isActive: true,
    };

    const session = this.sessionRepo.create(sessionData);
    const saved = await this.sessionRepo.save(session);
    // TypeORM save() can return Entity | Entity[], but we're saving a single entity
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async updateSessionActivity(tokenHash: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { tokenHash, isActive: true },
    });

    if (session) {
      session.lastActivityAt = new Date();
      await this.sessionRepo.save(session);
    }
  }

  async revokeSession(sessionId: string, adminId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, adminId },
    });

    if (session) {
      session.isActive = false;
      await this.sessionRepo.save(session);
    }
  }

  async revokeAllOtherSessions(
    currentSessionId: string,
    adminId: string
  ): Promise<void> {
    await this.sessionRepo
      .createQueryBuilder()
      .update(AdminSession)
      .set({ isActive: false })
      .where("adminId = :adminId", { adminId })
      .andWhere("isActive = :isActive", { isActive: true })
      .andWhere("id != :currentSessionId", { currentSessionId })
      .execute();
  }

  async getActiveSessions(adminId: string): Promise<AdminSession[]> {
    return await this.sessionRepo.find({
      where: { adminId, isActive: true },
      order: { lastActivityAt: "DESC" },
    });
  }

  async getSessionByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    return await this.sessionRepo.findOne({
      where: { tokenHash, isActive: true },
    });
  }

  getSecurityPageKey(): string | null {
    return this.configService.get<string>("SECURITY_PAGE_KEY") || null;
  }

  private hashCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }
}
