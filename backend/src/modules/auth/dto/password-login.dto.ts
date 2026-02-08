import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PasswordLoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
