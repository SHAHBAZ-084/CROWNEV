import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from './helpers.js';

let transporter: nodemailer.Transporter | null = null;

const PLACEHOLDER_KEYS = new Set(['', 'your-api-key', 're_YOUR_API_KEY', 're_your_api_key']);

export function isSmtpConfigured(): boolean {
  const { host, pass } = env.smtp;
  return Boolean(host && pass && !PLACEHOLDER_KEYS.has(pass.trim()));
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;

  if (!transporter) {
    const { host, port, user, pass } = env.smtp;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user: user || 'resend', pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

function resendSandboxHint(message: string): string | null {
  const match = message.match(/only send testing emails to your own email address \(([^)]+)\)/i);
  if (!match) return null;
  return `Resend test mode only sends OTP emails to ${match[1]}. Register with that address, or verify your domain at resend.com/domains for production.`;
}

function logDevOtp(email: string, otp: string, purpose: string, smtpNote?: string) {
  if (env.nodeEnv === 'production') return;
  console.log(`[DEV] OTP for ${email} (${purpose}): ${otp}`);
  if (smtpNote) console.log(`[DEV] ${smtpNote}`);
}

export async function sendOtpEmail(email: string, otp: string, purpose: string) {
  const transport = getTransporter();
  if (!transport) {
    logDevOtp(email, otp, purpose, 'Configure SMTP_HOST + SMTP_PASS in backend/.env to send real emails.');
    return;
  }

  try {
    const info = await transport.sendMail({
      from: env.smtp.from,
      to: email,
      subject: `Crown Ev — ${purpose} OTP`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#B34700">Crown Ev Bikes</h2>
          <p>Your OTP for <strong>${purpose}</strong> is:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0">${otp}</p>
          <p style="color:#666">This code expires in ${env.otpExpiryMinutes} minutes. Do not share it.</p>
        </div>
      `,
      text: `Crown Ev — Your ${purpose} OTP is ${otp}. Expires in ${env.otpExpiryMinutes} minutes.`,
    });

    if (env.nodeEnv !== 'production') {
      console.log(`[SMTP] OTP email sent to ${email} (${purpose}) — messageId: ${info.messageId}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`[SMTP] Failed to send OTP to ${email}:`, message);

    const sandboxHint = resendSandboxHint(message);
    if (sandboxHint && env.nodeEnv !== 'production') {
      logDevOtp(email, otp, purpose, sandboxHint);
      return;
    }

    if (env.nodeEnv !== 'production') {
      logDevOtp(email, otp, purpose, 'SMTP failed — use OTP above from the backend terminal.');
      return;
    }

    throw new AppError(
      503,
      sandboxHint ?? 'Could not send OTP email. Please try again later.',
    );
  }
}

function formatEmailDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatEmailTime(value: string): string {
  const [h, m] = value.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return value;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m ?? '00'} ${ampm}`;
}

export type BookingConfirmationEmail = {
  to: string;
  customerName: string;
  bookingId: number;
  visitDate: Date | string;
  visitTime: string;
  branch: { name: string; location: string; phone?: string | null };
  serviceName?: string | null;
  dashboardUrl: string;
};

/** Sends visit confirmation — failures are logged only (booking update must not fail). */
export async function sendBookingConfirmationEmail(data: BookingConfirmationEmail) {
  const transport = getTransporter();
  const visitDateLabel = formatEmailDate(data.visitDate);
  const visitTimeLabel = formatEmailTime(data.visitTime);
  const ticketUrl = `${data.dashboardUrl}/service-ticket/${data.bookingId}?email=${encodeURIComponent(data.to)}`;
  const dashboardUrl = `${data.dashboardUrl}/customer/bookings`;
  const serviceLine = data.serviceName ? `<p><strong>Service:</strong> ${data.serviceName}</p>` : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h2 style="color:#B34700;margin:0 0 8px">Crown Ev — Visit Confirmed</h2>
      <p>Hi ${data.customerName},</p>
      <p>Your service appointment has been scheduled. Please visit the branch at the time below.</p>
      <div style="background:#FFF7F0;border:1px solid #F0C9A8;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 4px;font-size:13px;color:#666">Date &amp; time</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#B34700">${visitDateLabel}</p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:700">${visitTimeLabel}</p>
      </div>
      <div style="margin:20px 0">
        <p style="margin:0 0 4px"><strong>Branch:</strong> ${data.branch.name}</p>
        <p style="margin:0 0 4px"><strong>Location:</strong> ${data.branch.location}</p>
        ${data.branch.phone ? `<p style="margin:0"><strong>Phone:</strong> ${data.branch.phone}</p>` : ''}
      </div>
      ${serviceLine}
      <p style="margin:24px 0 12px">Booking reference: <strong>#${data.bookingId}</strong></p>
      <p>
        <a href="${ticketUrl}" style="display:inline-block;background:#B34700;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
          Download your visit ticket
        </a>
      </p>
      <p style="font-size:13px;color:#666;margin-top:20px">
        Logged in? Open <a href="${dashboardUrl}"><strong>My Bookings</strong></a> in your dashboard to download anytime.
      </p>
    </div>
  `;

  const text = [
    `Hi ${data.customerName},`,
    '',
    'Your Crown Ev service visit is confirmed.',
    '',
    `Date: ${visitDateLabel}`,
    `Time: ${visitTimeLabel}`,
    `Branch: ${data.branch.name}`,
    `Location: ${data.branch.location}`,
    data.branch.phone ? `Phone: ${data.branch.phone}` : '',
    data.serviceName ? `Service: ${data.serviceName}` : '',
    `Booking #${data.bookingId}`,
    '',
    `Download your ticket: ${ticketUrl}`,
    `Dashboard: ${dashboardUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (!transport) {
    console.log(`[DEV] Booking confirmation for ${data.to} (#${data.bookingId}): ${visitDateLabel} at ${visitTimeLabel}`);
    console.log(`[DEV] Ticket URL: ${ticketUrl}`);
    return;
  }

  try {
    const info = await transport.sendMail({
      from: env.smtp.from,
      to: data.to,
      subject: `Crown Ev — Visit confirmed on ${visitDateLabel} at ${visitTimeLabel}`,
      html,
      text,
    });
    if (env.nodeEnv !== 'production') {
      console.log(`[SMTP] Booking confirmation sent to ${data.to} (#${data.bookingId}) — ${info.messageId}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`[SMTP] Failed to send booking confirmation to ${data.to}:`, message);
    if (env.nodeEnv !== 'production') {
      console.log(`[DEV] Booking #${data.bookingId} — ${visitDateLabel} at ${visitTimeLabel} (email not delivered)`);
      console.log(`[DEV] Ticket URL: ${ticketUrl}`);
    }
  }
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function deliverMail(
  to: string,
  subject: string,
  html: string,
  text: string,
  devLogLabel: string,
  replyTo?: string,
): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[DEV] ${devLogLabel} → ${to}`);
    console.log(`[DEV] ${text.split('\n').slice(0, 8).join('\n')}`);
    return true;
  }

  try {
    const info = await transport.sendMail({
      from: env.smtp.from,
      to,
      subject,
      html,
      text,
      ...(replyTo && { replyTo }),
    });
    if (env.nodeEnv !== 'production') {
      console.log(`[SMTP] ${devLogLabel} sent to ${to} — ${info.messageId}`);
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`[SMTP] Failed: ${devLogLabel} to ${to}:`, message);
    const sandboxHint = resendSandboxHint(message);
    if (sandboxHint) {
      console.error(`[SMTP] ${sandboxHint}`);
    }
    if (env.nodeEnv !== 'production') {
      console.log(`[DEV] ${devLogLabel} (email not delivered) → ${to}`);
    }
    return false;
  }
}

export type ContactFormEmail = {
  messageId: number;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  branchName?: string | null;
};

/** Notifies business inbox + sends confirmation copy to the sender's email. */
export async function sendContactFormEmails(data: ContactFormEmail) {
  const safeName = escHtml(data.name);
  const safeEmail = escHtml(data.email);
  const safePhone = data.phone ? escHtml(data.phone) : '';
  const safeMessage = escHtml(data.message).replace(/\n/g, '<br />');
  const branchLine = data.branchName
    ? `<p style="margin:0 0 8px"><strong>Branch:</strong> ${escHtml(data.branchName)}</p>`
    : '';

  const inboxSubject = `Crown Ev — New contact message from ${data.name}`;
  const inboxHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#B34700;margin:0 0 12px">New Contact Form Message</h2>
        <p style="margin:0 0 16px;color:#666">Reference #${data.messageId}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#666;width:100px">Name</td><td style="padding:6px 0"><strong>${safeName}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
          ${safePhone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${safePhone}</td></tr>` : ''}
        </table>
        ${branchLine}
        <div style="margin-top:16px;padding:16px;background:#FFF7F0;border:1px solid #F0C9A8;border-radius:10px">
          <p style="margin:0 0 6px;font-size:12px;color:#666">Message</p>
          <p style="margin:0;white-space:pre-wrap;line-height:1.5">${safeMessage}</p>
        </div>
        <p style="margin-top:20px;font-size:13px;color:#666">Reply directly to ${safeEmail} to respond.</p>
      </div>
    `;
  const inboxText = [
    `New contact message #${data.messageId}`,
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.phone ? `Phone: ${data.phone}` : '',
    data.branchName ? `Branch: ${data.branchName}` : '',
    '',
    'Message:',
    data.message,
  ]
    .filter(Boolean)
    .join('\n');

  const inboxSent = await deliverMail(
    env.contactInboxEmail,
    inboxSubject,
    inboxHtml,
    inboxText,
    'Contact inquiry (inbox)',
    data.email,
  );

  if (
    !inboxSent &&
    env.contactDevInboxEmail &&
    env.contactDevInboxEmail.toLowerCase() !== env.contactInboxEmail.toLowerCase()
  ) {
    console.warn(
      `[SMTP] Contact inbox (${env.contactInboxEmail}) blocked — forwarding copy to ${env.contactDevInboxEmail}`,
    );
    await deliverMail(
      env.contactDevInboxEmail,
      `[DEV COPY] ${inboxSubject}`,
      `${inboxHtml}<p style="margin-top:16px;font-size:12px;color:#b45309"><strong>Dev note:</strong> Intended inbox was ${escHtml(env.contactInboxEmail)}. Verify crownevcenter.com in Resend for production delivery.</p>`,
      `${inboxText}\n\n[DEV] Intended inbox: ${env.contactInboxEmail}`,
      'Contact inquiry (dev fallback)',
      data.email,
    );
  }

  await deliverMail(
    data.email,
    'Crown Ev — We received your message',
    `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#B34700;margin:0 0 8px">Thank You for Contacting Crown Ev</h2>
        <p>Hi ${safeName},</p>
        <p>We received your message and our team will get back to you within <strong>24 hours</strong>.</p>
        <div style="margin:20px 0;padding:16px;background:#f8f8f8;border-radius:10px;border:1px solid #eee">
          <p style="margin:0 0 6px;font-size:12px;color:#666">Your message</p>
          <p style="margin:0;line-height:1.5;white-space:pre-wrap">${safeMessage}</p>
        </div>
        <p style="font-size:13px;color:#666">Reference: <strong>#${data.messageId}</strong></p>
        <p style="margin-top:20px;font-size:13px;color:#666">
          Need urgent help? Call us or visit your nearest Crown Ev branch.
        </p>
      </div>
    `,
    [
      `Hi ${data.name},`,
      '',
      'Thank you for contacting Crown Ev Bikes.',
      'We received your message and will reply within 24 hours.',
      '',
      `Reference #${data.messageId}`,
      '',
      'Your message:',
      data.message,
    ].join('\n'),
    'Contact confirmation (sender)',
  );
}
