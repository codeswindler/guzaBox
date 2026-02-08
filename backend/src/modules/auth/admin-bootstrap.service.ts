import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit() {
    await this.authService.ensureDefaultAdmin();
  }
}
