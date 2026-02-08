import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsOptional()
  email?: string;
}
