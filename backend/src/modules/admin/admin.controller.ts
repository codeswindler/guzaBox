import { Body, Controller, Get, Post } from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("me")
  async me() {
    return { ok: true };
  }

  @Post("seed")
  async seed() {
    return this.adminService.seedTransactions();
  }

  @Post("simulate-payments")
  async simulatePayments(@Body() body?: { count?: number }) {
    return this.adminService.simulatePayments(body?.count);
  }
}
