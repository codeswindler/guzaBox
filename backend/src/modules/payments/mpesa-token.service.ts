import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class MpesaTokenService {
  private readonly logger = new Logger(MpesaTokenService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      this.logger.log('Using cached M-Pesa access token');
      return this.accessToken;
    }

    // Generate new token
    const consumerKey = this.configService.get<string>("MPESA_CONSUMER_KEY");
    const consumerSecret = this.configService.get<string>("MPESA_CONSUMER_SECRET");
    const baseUrl = this.configService.get<string>("MPESA_BASE_URL");

    this.logger.log(`Generating M-Pesa token with URL: ${baseUrl}`);
    this.logger.log(`Consumer Key: ${consumerKey?.substring(0, 10)}...`);

    if (!consumerKey || !consumerSecret || !baseUrl) {
      throw new Error("M-Pesa consumer credentials not configured");
    }

    try {
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
      this.logger.log(`Auth header: Basic ${auth.substring(0, 20)}...`);

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

      this.logger.log(`M-Pesa access token generated successfully: ${this.accessToken?.substring(0, 20)}...`);
      
      if (!this.accessToken) {
        this.logger.error('No access token received from M-Pesa');
        throw new Error("No access token received");
      }
      return this.accessToken;
    } catch (error: any) {
      this.logger.error("Failed to generate M-Pesa access token:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        code: error.code,
        config: error.config?.url,
      });
      throw new Error("Failed to generate M-Pesa access token");
    }
  }

  async refreshToken(): Promise<string> {
    this.logger.log('Force refreshing M-Pesa token');
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
