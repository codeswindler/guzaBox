import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PasswordLoginDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
