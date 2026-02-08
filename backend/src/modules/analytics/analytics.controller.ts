import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  async summary() {
    return this.analyticsService.getSummary();
  }

  @Get("overview")
  async overview() {
    return this.analyticsService.getOverview();
  }

  @Get("trends")
  async trends(@Query("range") range = "daily") {
    const granularity =
      range === "weekly" || range === "monthly" ? range : "daily";
    return this.analyticsService.getTrends(granularity);
  }

  @Get("demographics")
  async demographics() {
    return this.analyticsService.getDemographics();
  }
}
