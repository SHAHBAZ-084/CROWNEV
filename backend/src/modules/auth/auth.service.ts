import { BranchPermission, OtpType, Role } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { ensureOnlineCustomer } from '../customers/customers.service.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/helpers.js';
import {
  comparePassword,
  generateOtp,
  hashPassword,
  signToken,
} from '../../utils/crypto.js';
import { sendOtpEmail } from '../../utils/email.js';

const oauthClient = new OAuth2Client(env.googleClientId);

const MAX_OTP_ATTEMPTS = 5;

function authUserPayload(user: {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
  branchId: number | null;
  branchPermission?: BranchPermission;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? null,
    city: user.city ?? null,
    branchId: user.branchId,
    ...(user.role === Role.BRANCH_OWNER && {
      branchPermission: user.branchPermission ?? BranchPermission.WRITE_UPDATE_DELETE,
    }),
  };
}

function signAuthToken(user: {
  id: string;
  email: string;
  role: Role;
  branchId: number | null;
  branchPermission?: BranchPermission;
}) {
  return signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    ...(user.role === Role.BRANCH_OWNER && {
      branchPermission: user.branchPermission ?? BranchPermission.WRITE_UPDATE_DELETE,
    }),
  });
}

type RegistrationPayload = {
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
};

function parseRegistrationPayload(payload: unknown): RegistrationPayload {
  if (!payload || typeof payload !== 'object') {
    throw new AppError(400, 'Registration data expired. Please register again.');
  }
  const data = payload as RegistrationPayload;
  if (!data.passwordHash || !data.firstName || !data.lastName) {
    throw new AppError(400, 'Registration data expired. Please register again.');
  }
  return data;
}

export async function register(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  city?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing?.isVerified) throw new AppError(409, 'Email already registered');

  // Remove legacy unverified accounts from the old flow
  if (existing && !existing.isVerified) {
    await prisma.user.delete({ where: { email: data.email } });
  }

  const passwordHash = await hashPassword(data.password);
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);

  await prisma.otpVerification.deleteMany({
    where: { email: data.email, type: OtpType.REGISTRATION, usedAt: null },
  });

  await prisma.otpVerification.create({
    data: {
      email: data.email,
      otp,
      type: OtpType.REGISTRATION,
      expiresAt,
      payload: {
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        city: data.city ?? null,
      },
    },
  });
  await sendOtpEmail(data.email, otp, 'registration');

  return { message: 'OTP sent to email. Verify to complete registration.' };
}

export async function verifyRegistration(email: string, otp: string) {
  const record = await prisma.otpVerification.findFirst({
    where: { email, type: OtpType.REGISTRATION, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired OTP');
  }
  if (record.failedAttempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError(429, 'Too many OTP attempts. Request a new code.');
  }
  if (record.otp !== otp) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { failedAttempts: { increment: 1 } },
    });
    throw new AppError(400, 'Invalid OTP');
  }

  const payload = parseRegistrationPayload(record.payload);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.isVerified) throw new AppError(409, 'Email already registered');
  if (existing && !existing.isVerified) {
    await prisma.user.delete({ where: { email } });
  }

  const user = await prisma.$transaction(async (tx) => {
    const marked = await tx.otpVerification.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        otp,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (marked.count !== 1) {
      throw new AppError(400, 'Invalid or expired OTP');
    }

    const created = await tx.user.create({
      data: {
        email,
        passwordHash: payload.passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone ?? undefined,
        city: payload.city ?? undefined,
        role: Role.CUSTOMER,
        isVerified: true,
      },
    });

    await ensureOnlineCustomer(created, tx);
    return created;
  });

  const token = signAuthToken(user);

  return {
    token,
    user: authUserPayload(user),
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    const pending = await prisma.otpVerification.findFirst({
      where: {
        email,
        type: OtpType.REGISTRATION,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      throw new AppError(403, 'Please verify your email to complete registration');
    }
    throw new AppError(401, 'Invalid credentials');
  }
  if (!user.isVerified) throw new AppError(403, 'Email not verified');
  if (!user.isActive) throw new AppError(403, 'Account deactivated');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const token = signAuthToken(user);

  return {
    token,
    user: authUserPayload(user),
  };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: 'If the email exists, an OTP has been sent' };

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);
  await prisma.otpVerification.create({
    data: { email, otp, type: OtpType.PASSWORD_RESET, expiresAt },
  });
  await sendOtpEmail(email, otp, 'password reset');

  return { message: 'If the email exists, an OTP has been sent' };
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const record = await prisma.otpVerification.findFirst({
    where: { email, type: OtpType.PASSWORD_RESET, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired OTP');
  }
  if (record.failedAttempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError(429, 'Too many OTP attempts. Request a new code.');
  }
  if (record.otp !== otp) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { failedAttempts: { increment: 1 } },
    });
    throw new AppError(400, 'Invalid OTP');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const marked = await tx.otpVerification.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        otp,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (marked.count !== 1) {
      throw new AppError(400, 'Invalid or expired OTP');
    }

    await tx.user.update({
      where: { email },
      data: { passwordHash },
    });
  });

  return { message: 'Password reset successful' };
}

export async function googleAuth(idToken: string) {
  if (!env.googleClientId) {
    throw new AppError(503, 'Google sign-in is not configured');
  }

  let payload;
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, 'Invalid Google token');
  }
  if (!payload?.sub || !payload?.email) {
    throw new AppError(401, 'Invalid Google token');
  }

  const googleId = payload.sub;
  const email = payload.email;
  const firstName = payload.given_name ?? '';
  const lastName = payload.family_name ?? '';

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });

  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          googleId,
          firstName,
          lastName,
          role: Role.CUSTOMER,
          isVerified: true,
        },
      });
      await ensureOnlineCustomer(created, tx);
      return created;
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, isVerified: true },
    });
  }

  if (!user.isActive) throw new AppError(403, 'Account deactivated');

  await ensureOnlineCustomer(user);

  const token = signAuthToken(user);

  return {
    token,
    user: authUserPayload(user),
  };
}

const userSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  city: true,
  branchId: true,
  branchPermission: true,
  isVerified: true,
  createdAt: true,
} as const;

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { ...userSelect, passwordHash: true },
  });
  const { passwordHash, ...rest } = user;
  return { ...authUserPayload(rest), hasPassword: !!passwordHash };
}

export async function updateProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; phone?: string; city?: string }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { ...userSelect, passwordHash: true },
  });
  const { passwordHash, ...rest } = user;
  return { ...authUserPayload(rest), hasPassword: !!passwordHash };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new AppError(400, 'Password change is not available for this account');
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(401, 'Current password is incorrect');

  if (currentPassword === newPassword) {
    throw new AppError(400, 'New password must be different from current password');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { message: 'Password updated successfully' };
}

export async function deleteMyAccount(
  userId: string,
  data: { currentPassword?: string; confirmEmail?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (user.role !== Role.CUSTOMER) {
    throw new AppError(403, 'Only customer accounts can be deleted from profile');
  }
  if (!user.isActive) throw new AppError(400, 'Account already deactivated');

  if (user.passwordHash) {
    if (!data.currentPassword) throw new AppError(400, 'Current password is required');
    const valid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, 'Current password is incorrect');
  } else {
    const confirmed = data.confirmEmail?.trim().toLowerCase();
    if (!confirmed || confirmed !== user.email.toLowerCase()) {
      throw new AppError(400, 'Enter your email address to confirm account deletion');
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  return { message: 'Account deleted successfully' };
}

/** Remove customer accounts that were created before email verification was enforced. */
export async function cleanupUnverifiedCustomers() {
  const result = await prisma.user.deleteMany({
    where: { role: Role.CUSTOMER, isVerified: false },
  });
  return result.count;
}
