export type SmsPayload = {
  to: string;
  message: string;
};

export interface SmsProvider {
  send(payload: SmsPayload): Promise<void>;
}
