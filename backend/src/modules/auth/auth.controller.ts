import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PasswordLoginDto } from "./dto/password-login.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

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
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post("login")
  async passwordLogin(@Body() dto: PasswordLoginDto) {
    return this.authService.loginWithPassword(
      dto.identifier,
      dto.password,
      dto.email
    );
  }
}
