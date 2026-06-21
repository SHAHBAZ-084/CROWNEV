import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && env.smtp.host) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendOtpEmail(email: string, otp: string, purpose: string) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[DEV] OTP for ${email} (${purpose}): ${otp}`);
    return;
  }

  await transport.sendMail({
    from: env.smtp.from,
    to: email,
    subject: `Crown Eve — ${purpose} OTP`,
    html: `
      <h2>Crown Eve Bikes</h2>
      <p>Your OTP for ${purpose} is:</p>
      <h1 style="letter-spacing:4px">${otp}</h1>
      <p>This code expires in ${env.otpExpiryMinutes} minutes.</p>
    `,
  });
}
