import { sendTwilioSmsServerFn } from "./twilio-api";

export type SmsPlaceholderRequest = {
  recipient: string;
  message: string;
  timestamp: string;
};

export type SmsPlaceholderResult = {
  /** true ONLY when Twilio accepted the message for delivery. */
  sent: boolean;
  sid?: string;
  error?: string;
  request: SmsPlaceholderRequest;
};

/**
 * Sends an SMS via the Twilio server function. Results are honest:
 * failures are reported as failures so the UI can surface them.
 */
export async function sendSmsPlaceholder(request: SmsPlaceholderRequest): Promise<SmsPlaceholderResult> {
  try {
    const result = (await sendTwilioSmsServerFn({
      data: {
        to: request.recipient,
        body: request.message,
      },
    })) as any;

    if (result?.success) {
      return { sent: true, sid: result.sid, request };
    }

    return { sent: false, error: result?.error || "SMS delivery failed.", request };
  } catch (err: any) {
    return {
      sent: false,
      error: err?.message || "SMS request failed.",
      request,
    };
  }
}
