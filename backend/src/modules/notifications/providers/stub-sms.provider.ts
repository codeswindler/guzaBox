import { SmsPayload, SmsProvider } from "./sms-provider";

export class StubSmsProvider implements SmsProvider {
  async send(payload: SmsPayload): Promise<void> {
    // Stub provider for development; replace with real SMS gateway.
    // eslint-disable-next-line no-console
    console.log("[SMS STUB]", payload.to, payload.message);
  }
}
