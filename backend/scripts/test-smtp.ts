/**
 * Quick SMTP check — run: npm run email:test -- your@email.com
 * Uses the same sendOtpEmail() path as registration / password reset.
 */
import { env } from '../src/config/env.js';
import { isSmtpConfigured, sendOtpEmail } from '../src/utils/email.js';

const to = process.argv[2];

if (!to) {
  console.error('Usage: npm run email:test -- your@email.com');
  process.exit(1);
}

if (!isSmtpConfigured()) {
  console.error('SMTP is not configured. Set these in backend/.env:');
  console.error('  SMTP_HOST=smtp.resend.com');
  console.error('  SMTP_PORT=465');
  console.error('  SMTP_USER=resend');
  console.error('  SMTP_PASS=re_...   (your Resend API key)');
  console.error('  EMAIL_FROM=onboarding@resend.dev');
  process.exit(1);
}

console.log(`Sending test OTP to ${to} from ${env.smtp.from} via ${env.smtp.host}...`);

sendOtpEmail(to, '482910', 'test')
  .then(() => {
    console.log('Done — check the inbox (and spam) for the test OTP.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
