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
  /** Service booking confirmations — sent from info@ (same Hostinger password as contact@ by default). */
  bookingSmtp: {
    user: process.env.BOOKING_SMTP_USER ?? process.env.INFO_EMAIL ?? 'info@crownevcenter.com',
    from: process.env.BOOKING_EMAIL_FROM ?? process.env.INFO_EMAIL ?? 'info@crownevcenter.com',
    pass: process.env.BOOKING_SMTP_PASS ?? process.env.SMTP_PASS ?? '',
  },
  contactInboxEmail: process.env.CONTACT_INBOX_EMAIL ?? 'contact@crownevcenter.com',
  /** Dev-only: receives contact inquiries when Resend sandbox blocks the real inbox. */
  contactDevInboxEmail: process.env.CONTACT_DEV_INBOX_EMAIL ?? '',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '5', 10),
  /** HTTP request / socket timeout (ms) — slow clients cannot block workers forever. */
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10),
  /** Prisma interactive transaction timeout (ms). */
  dbTransactionTimeoutMs: parseInt(process.env.DB_TRANSACTION_TIMEOUT_MS ?? '30000', 10),
  /** Max wait to acquire a connection for a transaction (ms). */
  dbTransactionMaxWaitMs: parseInt(process.env.DB_TRANSACTION_MAX_WAIT_MS ?? '10000', 10),
  /** Suggested DATABASE_URL pool size — append ?connection_limit=N to your URL in production. */
  dbConnectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT ?? '10', 10),
};
