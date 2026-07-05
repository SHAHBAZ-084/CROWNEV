import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from './helpers.js';

let transporter: nodemailer.Transporter | null = null;
const transporterByUser = new Map<string, nodemailer.Transporter>();

const PLACEHOLDER_KEYS = new Set(['', 'your-api-key', 're_YOUR_API_KEY', 're_your_api_key']);

export function isSmtpConfigured(): boolean {
  const { host, pass } = env.smtp;
  return Boolean(host && pass && !PLACEHOLDER_KEYS.has(pass.trim()));
}

function createSmtpTransport(user: string, pass: string) {
  const { host, port } = env.smtp;
  return nodemailer.createTransport({
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

/** Default mailbox (contact@) for OTP and contact form. */
function getTransporter() {
  if (!isSmtpConfigured()) return null;

  if (!transporter) {
    transporter = createSmtpTransport(env.smtp.user, env.smtp.pass);
  }
  return transporter;
}

/** Optional second mailbox (info@) for booking confirmations. */
function getTransporterFor(user: string, pass: string) {
  if (!isSmtpConfigured()) return null;

  const mailboxPass = pass.trim();
  if (!mailboxPass || PLACEHOLDER_KEYS.has(mailboxPass)) return null;

  let transport = transporterByUser.get(user);
  if (!transport) {
    transport = createSmtpTransport(user, mailboxPass);
    transporterByUser.set(user, transport);
  }
  return transport;
}

function getBookingTransporter() {
  const { user, pass } = env.bookingSmtp;
  if (user === env.smtp.user && pass === env.smtp.pass) {
    return getTransporter();
  }
  return getTransporterFor(user, pass);
}

function resendSandboxHint(message: string): string | null {
  const match = message.match(/only send testing emails to your own email address \(([^)]+)\)/i);
  if (!match) return null;
  return `Resend test mode only sends OTP emails to ${match[1]}. Register with that address, or verify your domain at resend.com/domains for production.`;
}

function parseFromAddress(raw: string): { name?: string; address: string } {
  const angle = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    return { name: angle[1].replace(/^"|"$/g, '').trim(), address: angle[2].trim() };
  }
  return { address: raw.replace(/^"|"$/g, '').trim() };
}

/** Inbox shows display name (e.g. OTP, Contact) instead of the mailbox local-part. */
function formatFrom(displayName: string, fromOverride?: string): string {
  const { address } = parseFromAddress(fromOverride ?? env.smtp.from);
  return `"${displayName}" <${address}>`;
}

function logDevOtp(email: string, otp: string, purpose: string, smtpNote?: string) {
  if (env.nodeEnv === 'production') return;
  console.log(`[DEV] OTP for ${email} (${purpose}): ${otp}`);
  if (smtpNote) console.log(`[DEV] ${smtpNote}`);
}

const EMAIL_ACCENT = '#B34700';
const EMAIL_WEBSITE = 'https://crownevcenter.com';
const EMAIL_PHONES = '0300 698 3345 or 0300 449 4545';

function emailFooterHtml(): string {
  const support = env.contactInboxEmail;
  return `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #eee;font-size:13px;color:#666">
      <p style="margin:0 0 8px"><strong>Crown Ev Bikes</strong></p>
      <p style="margin:0 0 4px">Pakistan&apos;s premium electric mobility platform.</p>
      <p style="margin:0 0 4px"><a href="${EMAIL_WEBSITE}" style="color:${EMAIL_ACCENT}">crownevcenter.com</a></p>
      <p style="margin:0 0 4px">Email: <a href="mailto:${support}" style="color:${EMAIL_ACCENT}">${support}</a></p>
      <p style="margin:0">Phone: ${EMAIL_PHONES}</p>
    </div>
  `;
}

function emailFooterText(): string {
  return [
    '',
    'Crown Ev Bikes',
    'Pakistan\'s premium electric mobility platform.',
    EMAIL_WEBSITE,
    `Email: ${env.contactInboxEmail}`,
    `Phone: ${EMAIL_PHONES}`,
  ].join('\n');
}

function emailShell(body: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6">
      ${body}
      ${emailFooterHtml()}
    </div>
  `;
}

function otpCodeBox(otp: string): string {
  return `
    <div style="background:#FFF7F0;border:1px solid #F0C9A8;border-radius:12px;padding:24px;margin:24px 0;text-align:center">
      <p style="margin:0 0 8px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Your verification code</p>
      <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:${EMAIL_ACCENT}">${otp}</p>
    </div>
  `;
}

type OtpPurposeKey = 'registration' | 'password_reset' | 'test';

function parseOtpPurpose(purpose: string): OtpPurposeKey {
  const normalized = purpose.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'password_reset') return 'password_reset';
  if (normalized === 'test') return 'test';
  return 'registration';
}

function buildOtpEmailContent(purpose: string, otp: string) {
  const key = parseOtpPurpose(purpose);
  const expiry = env.otpExpiryMinutes;

  const copy: Record<
    OtpPurposeKey,
    { subject: string; heading: string; intro: string; steps: string[]; closing: string }
  > = {
    registration: {
      subject: 'Verify your Crown Ev account',
      heading: 'Complete your registration',
      intro:
        'Thank you for creating an account with Crown Ev Bikes. To keep your account secure, please verify your email address using the code below.',
      steps: [
        'Open the Crown Ev registration page where you started signing up.',
        'Enter the verification code exactly as shown in this email.',
        'Once verified, you can sign in, browse electric bikes, book service visits, and track orders from your dashboard.',
      ],
      closing:
        'If you did not request this account, you can safely ignore this email. No account will be created without verification.',
    },
    password_reset: {
      subject: 'Reset your Crown Ev password',
      heading: 'Password reset request',
      intro:
        'We received a request to reset the password for your Crown Ev account. Use the verification code below to choose a new password.',
      steps: [
        'Return to the Crown Ev forgot password page.',
        'Enter the verification code below together with your new password.',
        'After resetting, sign in with your new password to access your account.',
      ],
      closing:
        'If you did not request a password reset, please ignore this email. Your current password will stay unchanged.',
    },
    test: {
      subject: 'Crown Ev email test',
      heading: 'SMTP test message',
      intro:
        'This is a test email from Crown Ev Bikes. Your mail server is configured correctly if you received this message.',
      steps: ['Use the code below only for this delivery test.'],
      closing: 'No action is required on your account.',
    },
  };

  const content = copy[key];
  const stepsHtml = content.steps
    .map((step, i) => `<p style="margin:0 0 10px"><strong>${i + 1}.</strong> ${step}</p>`)
    .join('');

  const html = emailShell(`
    <h2 style="color:${EMAIL_ACCENT};margin:0 0 12px">${content.heading}</h2>
    <p style="margin:0 0 16px">Hello,</p>
    <p style="margin:0 0 16px">${content.intro}</p>
    ${otpCodeBox(otp)}
    <p style="margin:0 0 16px;color:#666">
      This code expires in <strong>${expiry} minutes</strong>. For your security, do not share it with anyone.
      Crown Ev staff will never ask for this code by phone or message.
    </p>
    <p style="margin:0 0 8px;font-weight:600">What to do next</p>
    ${stepsHtml}
    <p style="margin:16px 0 0;color:#666">${content.closing}</p>
  `);

  const stepsText = content.steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  const text = [
    content.heading,
    '',
    'Hello,',
    '',
    content.intro,
    '',
    'Your verification code:',
    otp,
    '',
    `This code expires in ${expiry} minutes. Do not share it with anyone.`,
    '',
    'What to do next:',
    stepsText,
    '',
    content.closing,
    emailFooterText(),
  ].join('\n');

  return { subject: content.subject, html, text };
}

export async function sendOtpEmail(email: string, otp: string, purpose: string) {
  const transport = getTransporter();
  if (!transport) {
    logDevOtp(email, otp, purpose, 'Configure SMTP_HOST + SMTP_PASS in backend/.env to send real emails.');
    return;
  }

  const { subject, html, text } = buildOtpEmailContent(purpose, otp);

  try {
    const info = await transport.sendMail({
      from: formatFrom('Crown Ev'),
      to: email,
      subject,
      html,
      text,
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
  const transport = getBookingTransporter();
  const bookingFrom = formatFrom('Crown Ev', env.bookingSmtp.from);
  const visitDateLabel = formatEmailDate(data.visitDate);
  const visitTimeLabel = formatEmailTime(data.visitTime);
  const ticketUrl = `${data.dashboardUrl}/service-ticket/${data.bookingId}?email=${encodeURIComponent(data.to)}`;
  const dashboardUrl = `${data.dashboardUrl}/customer/bookings`;
  const serviceBlock = data.serviceName
    ? `<p style="margin:12px 0 0"><strong>Service type:</strong> ${escHtml(data.serviceName)}</p>`
    : '';

  const html = emailShell(`
    <h2 style="color:${EMAIL_ACCENT};margin:0 0 12px">Your service visit is confirmed</h2>
    <p style="margin:0 0 16px">Hi ${escHtml(data.customerName)},</p>
    <p style="margin:0 0 16px">
      Thank you for booking a service visit with Crown Ev Bikes. Your appointment has been scheduled.
      Please arrive at the branch on time so our team can assist you without delay.
    </p>
    <div style="background:#FFF7F0;border:1px solid #F0C9A8;border-radius:12px;padding:20px;margin:20px 0">
      <p style="margin:0 0 4px;font-size:13px;color:#666">Scheduled visit</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:${EMAIL_ACCENT}">${visitDateLabel}</p>
      <p style="margin:8px 0 0;font-size:20px;font-weight:700">${visitTimeLabel}</p>
    </div>
    <div style="margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600">Branch details</p>
      <p style="margin:0 0 4px"><strong>Name:</strong> ${escHtml(data.branch.name)}</p>
      <p style="margin:0 0 4px"><strong>Address:</strong> ${escHtml(data.branch.location)}</p>
      ${data.branch.phone ? `<p style="margin:0"><strong>Phone:</strong> ${escHtml(data.branch.phone)}</p>` : ''}
      ${serviceBlock}
    </div>
    <p style="margin:0 0 8px;font-weight:600">Before you visit</p>
    <p style="margin:0 0 10px">1. Bring your bike registration details or order reference if available.</p>
    <p style="margin:0 0 10px">2. Arrive a few minutes early so check in is smooth.</p>
    <p style="margin:0 0 16px">3. If you need to reschedule, contact the branch directly or use your customer dashboard.</p>
    <p style="margin:0 0 16px">Booking reference: <strong>#${data.bookingId}</strong></p>
    <p style="font-size:13px;color:#666;margin:0">
      Open
      <a href="${dashboardUrl}" style="color:${EMAIL_ACCENT}"><strong>My Bookings</strong></a>
      in your Crown Ev dashboard to view or download your ticket anytime.
    </p>
  `);

  const text = [
    'Your Crown Ev service visit is confirmed',
    '',
    `Hi ${data.customerName},`,
    '',
    'Thank you for booking a service visit with Crown Ev Bikes. Your appointment has been scheduled.',
    'Please arrive at the branch on time so our team can assist you without delay.',
    '',
    'Scheduled visit',
    `Date: ${visitDateLabel}`,
    `Time: ${visitTimeLabel}`,
    '',
    'Branch details',
    `Name: ${data.branch.name}`,
    `Address: ${data.branch.location}`,
    data.branch.phone ? `Phone: ${data.branch.phone}` : '',
    data.serviceName ? `Service type: ${data.serviceName}` : '',
    '',
    'Before you visit',
    '1. Bring your bike registration details or order reference if available.',
    '2. Arrive a few minutes early so check in is smooth.',
    '3. If you need to reschedule, contact the branch directly or use your customer dashboard.',
    '',
    `Booking reference #${data.bookingId}`,
    '',
    `My Bookings: ${dashboardUrl}`,
    emailFooterText(),
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
      from: bookingFrom,
      to: data.to,
      subject: `Your Crown Ev service visit is confirmed for ${visitDateLabel}`,
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
  fromName = 'Contact',
): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[DEV] ${devLogLabel} → ${to}`);
    console.log(`[DEV] ${text.split('\n').slice(0, 8).join('\n')}`);
    return true;
  }

  try {
    const info = await transport.sendMail({
      from: formatFrom(fromName),
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

/** Notifies business inbox + sends confirmation copy to the sender's email. Returns delivery status. */
export async function sendContactFormEmails(data: ContactFormEmail): Promise<{
  inboxSent: boolean;
  confirmationSent: boolean;
}> {
  const safeName = escHtml(data.name);
  const safeEmail = escHtml(data.email);
  const safePhone = data.phone ? escHtml(data.phone) : '';
  const safeMessage = escHtml(data.message).replace(/\n/g, '<br />');
  const branchLine = data.branchName
    ? `<p style="margin:0 0 8px"><strong>Branch:</strong> ${escHtml(data.branchName)}</p>`
    : '';

  const inboxSubject = `New contact message from ${data.name} on Crown Ev`;
  const inboxHtml = emailShell(`
    <h2 style="color:${EMAIL_ACCENT};margin:0 0 12px">New contact form message</h2>
    <p style="margin:0 0 16px;color:#666">
      A visitor submitted the contact form on crownevcenter.com. Reference number <strong>#${data.messageId}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
      <tr><td style="padding:8px 0;color:#666;width:110px;vertical-align:top">Name</td><td style="padding:8px 0"><strong>${safeName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;vertical-align:top">Email</td><td style="padding:8px 0"><a href="mailto:${safeEmail}" style="color:${EMAIL_ACCENT}">${safeEmail}</a></td></tr>
      ${safePhone ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top">Phone</td><td style="padding:8px 0">${safePhone}</td></tr>` : ''}
    </table>
    ${branchLine}
    <div style="padding:16px;background:#FFF7F0;border:1px solid #F0C9A8;border-radius:10px">
      <p style="margin:0 0 8px;font-size:12px;color:#666">Message</p>
      <p style="margin:0;white-space:pre-wrap;line-height:1.5">${safeMessage}</p>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666">
      Please reply directly to <a href="mailto:${safeEmail}" style="color:${EMAIL_ACCENT}">${safeEmail}</a> to respond to this inquiry.
    </p>
  `);
  const inboxText = [
    'New contact form message',
    '',
    `Reference #${data.messageId}`,
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.phone ? `Phone: ${data.phone}` : '',
    data.branchName ? `Branch: ${data.branchName}` : '',
    '',
    'Message:',
    data.message,
    '',
    `Reply to: ${data.email}`,
    emailFooterText(),
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

  const confirmationSent = await deliverMail(
    data.email,
    'We received your message at Crown Ev',
    emailShell(`
      <h2 style="color:${EMAIL_ACCENT};margin:0 0 12px">Thank you for contacting Crown Ev</h2>
      <p style="margin:0 0 16px">Hi ${safeName},</p>
      <p style="margin:0 0 16px">
        We received your message and our team will review it shortly. A Crown Ev representative
        will get back to you within <strong>24 hours</strong> on business days.
      </p>
      <div style="margin:20px 0;padding:16px;background:#f8f8f8;border-radius:10px;border:1px solid #eee">
        <p style="margin:0 0 8px;font-size:12px;color:#666">Your message</p>
        <p style="margin:0;line-height:1.5;white-space:pre-wrap">${safeMessage}</p>
      </div>
      <p style="margin:0 0 16px;font-size:14px">Reference number: <strong>#${data.messageId}</strong></p>
      <p style="margin:0 0 10px;font-weight:600">Need help sooner?</p>
      <p style="margin:0 0 8px">Call us at ${EMAIL_PHONES} or visit your nearest Crown Ev branch.</p>
      <p style="margin:0;font-size:13px;color:#666">
        You can also browse electric bikes and book a service visit anytime at
        <a href="${EMAIL_WEBSITE}" style="color:${EMAIL_ACCENT}">crownevcenter.com</a>.
      </p>
    `),
    [
      'Thank you for contacting Crown Ev',
      '',
      `Hi ${data.name},`,
      '',
      'We received your message and our team will review it shortly.',
      'A Crown Ev representative will get back to you within 24 hours on business days.',
      '',
      `Reference #${data.messageId}`,
      '',
      'Your message:',
      data.message,
      '',
      'Need help sooner?',
      `Call us at ${EMAIL_PHONES} or visit your nearest Crown Ev branch.`,
      EMAIL_WEBSITE,
      emailFooterText(),
    ].join('\n'),
    'Contact confirmation (sender)',
  );

  if (env.nodeEnv === 'production' && !inboxSent && !confirmationSent) {
    console.error(
      `[SMTP] Contact #${data.messageId} saved to DB but NO emails delivered. ` +
        `Check SMTP settings (Hostinger or verified Resend domain). Inbox: ${env.contactInboxEmail}`,
    );
  }

  return { inboxSent, confirmationSent };
}
