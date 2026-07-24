export const MERCHANT_ACCESS_TOKEN_TYPE = 'merchant_access';
export const PHONE_CHANGE_CHALLENGE_TOKEN_TYPE = 'phone_change';
export const PHONE_CHANGE_CHALLENGE_TTL_SECONDS = 10 * 60;

export type PhoneChangeChallengePayload = {
  tokenType: typeof PHONE_CHANGE_CHALLENGE_TOKEN_TYPE;
  userId: number;
  tenantId: number;
  newPhone: string;
  verificationSid: string;
};
