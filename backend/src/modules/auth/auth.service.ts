import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { createHash, randomInt } from "crypto";
import { AdminUser } from "./entities/admin-user.entity";
import { OtpCode } from "./entities/otp-code.entity";
import { SmsService } from "../notifications/sms.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
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

  async verifyOtp(phone: string, code: string) {
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

    return { token };
  }

  async loginWithPassword(identifier: string, password: string) {
    const admin = await this.adminRepo.findOne({
      where: [{ phone: identifier }, { email: identifier }],
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

    return { token };
  }

  private hashCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }
}
