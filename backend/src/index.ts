import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { isSmtpConfigured } from './utils/email.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Crown Ev API running on port ${env.port} (${env.nodeEnv})`);
  if (isSmtpConfigured()) {
    console.log(`Email: SMTP via ${env.smtp.host} (from ${env.smtp.from})`);
  } else {
    console.log('Email: DEV mode — OTPs print to this terminal only (set SMTP_* in .env)');
  }
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(signal: string) {
  console.log(`${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    console.error('Shutdown timeout exceeded — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (err) => {
    if (err) console.error('Error closing HTTP server:', err);
    try {
      await prisma.$disconnect();
      console.log('Database disconnected');
    } catch (disconnectErr) {
      console.error('Error disconnecting Prisma:', disconnectErr);
    }
    clearTimeout(forceExit);
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
