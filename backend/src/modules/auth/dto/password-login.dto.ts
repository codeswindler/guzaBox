import { IsNotEmpty, IsString } from "class-validator";

export class PasswordLoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
