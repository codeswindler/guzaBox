import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class MpesaTokenService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Generate new token
    const consumerKey = this.configService.get<string>("MPESA_CONSUMER_KEY");
    const consumerSecret = this.configService.get<string>("MPESA_CONSUMER_SECRET");
    const baseUrl = this.configService.get<string>("MPESA_BASE_URL");

    if (!consumerKey || !consumerSecret || !baseUrl) {
      throw new Error("M-Pesa consumer credentials not configured");
    }

    try {
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
      
      const response = await axios.get(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      this.accessToken = response.data.access_token || null;
      // Set expiry to 55 minutes from now (tokens expire in 1 hour)
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

      console.log("M-Pesa access token generated successfully");
      if (!this.accessToken) {
        throw new Error("No access token received");
      }
      return this.accessToken;
    } catch (error: any) {
      console.error("Failed to generate M-Pesa access token:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error("Failed to generate M-Pesa access token");
    }
  }

  async refreshToken(): Promise<string> {
    this.accessToken = null;
    this.tokenExpiry = null;
    return this.getAccessToken();
  }

  isTokenValid(): boolean {
    return !!(this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date());
  }

  getTokenInfo() {
    return {
      hasToken: !!this.accessToken,
      tokenExpiry: this.tokenExpiry,
      isValid: this.isTokenValid(),
    };
  }
}
