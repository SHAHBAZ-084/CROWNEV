import { OtpType, Role } from '@prisma/client';
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
  phone?: string;
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
    where: { email, otp, type: OtpType.REGISTRATION, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired OTP');
  }

  const payload = parseRegistrationPayload(record.payload);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.isVerified) throw new AppError(409, 'Email already registered');
  if (existing && !existing.isVerified) {
    await prisma.user.delete({ where: { email } });
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.otpVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return tx.user.create({
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
  });

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      branchId: user.branchId,
    },
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

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      branchId: user.branchId,
    },
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
    where: { email, otp, type: OtpType.PASSWORD_RESET, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired OTP');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.otpVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { email },
      data: { passwordHash },
    }),
  ]);

  return { message: 'Password reset successful' };
}

export async function googleAuth(googleId: string, email: string, firstName: string, lastName: string) {
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        googleId,
        firstName,
        lastName,
        role: Role.CUSTOMER,
        isVerified: true,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, isVerified: true },
    });
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      branchId: user.branchId,
    },
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
  isVerified: true,
  createdAt: true,
} as const;

export async function getMe(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: userSelect,
  });
}

export async function updateProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; phone?: string; city?: string }
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: userSelect,
  });
}

/** Remove customer accounts that were created before email verification was enforced. */
export async function cleanupUnverifiedCustomers() {
  const result = await prisma.user.deleteMany({
    where: { role: Role.CUSTOMER, isVerified: false },
  });
  return result.count;
}
