import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '10', 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  appUrl: (process.env.APP_URL ?? process.env.ALLOWED_ORIGINS?.split(',')[0] ?? 'http://localhost:5173').replace(/\/$/, ''),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
  },
  contactInboxEmail: process.env.CONTACT_INBOX_EMAIL ?? 'contact@crownevcenter.com',
  /** Dev-only: receives contact inquiries when Resend sandbox blocks the real inbox. */
  contactDevInboxEmail: process.env.CONTACT_DEV_INBOX_EMAIL ?? '',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '5', 10),
};
