import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";

@Controller("payouts")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post("releases")
  async createRelease(
    @Body()
    body: {
      minWin: number;
      maxWin: number;
      releaseBudget: number;
      overrides?: { phoneNumber: string; amount: number }[];
    },
    @Req() req: { user?: { id: string } }
  ) {
    return this.payoutsService.releaseWinners({
      minWin: body.minWin,
      maxWin: body.maxWin,
      releaseBudget: body.releaseBudget,
      overrides: body.overrides,
      adminId: req.user?.id,
    });
  }

  @Post("preview")
  async previewRelease(
    @Body()
    body: {
      minWin: number;
      maxWin: number;
      releaseBudget: number;
      overrides?: { phoneNumber: string; amount: number }[];
    }
  ) {
    return this.payoutsService.previewRelease({
      minWin: body.minWin,
      maxWin: body.maxWin,
      releaseBudget: body.releaseBudget,
      overrides: body.overrides,
    });
  }

  @Get("releases")
  async listReleases() {
    return this.payoutsService.listReleases();
  }

  @Get("winners")
  async listWinners(
    @Query("instantOnly") instantOnly?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.payoutsService.listWinners({
      instantOnly: instantOnly === "true",
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("daily-collections")
  async getDailyCollections(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.payoutsService.getDailyCollections({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
