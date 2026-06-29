const CONSTANTS = {
  AUTH: {
    JWT: 'jwt',
    FACEBOOK: 'facebook',
  },
  ACCESS_TOKEN: 'access_token',
  SESSION: {
    EXPIRATION_TIME: 30 * 24 * 60 * 60,
    REFRESH_TOKEN_EXPIRATION_TIME: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
  SENTIMENTS: ['positive', 'negative', 'neutral'],
  CLASSIFICATIONS: [
    'inquiry',
    'complaint',
    'product order',
    'shipping / delivery inquiry',
    'return / refund request',
    'account management',
    'payment issue',
  ],
  UPLOAD: {
    MAX_IMAGE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
  },
};

export default CONSTANTS;
