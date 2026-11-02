import { z } from 'zod';
import type { Request } from 'express';
import { prisma } from '../../database/prisma';
import { authLog } from '../../common/audit';
import { badRequest, conflict, unauthorized } from '../../common/errors';
import {
  hashPassword, isValidCpf, onlyDigits, passwordMessage, passwordPolicy,
  randomToken, sha256, verifyPassword,
} from '../../common/utils';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const passwordField = z.string().regex(passwordPolicy, passwordMessage);

export const registerSchema = z.object({
  name: z.string().trim().min(5, 'Informe o nome completo').max(120),
  cpf: z.string().refine(isValidCpf, 'CPF inválido'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  phone: z.string().transform(onlyDigits).refine((v) => v.length >= 10 && v.length <= 11, 'Telefone inválido'),
  birthDate: z.string().optional().or(z.literal('')),
  institution: z.string().trim().max(150).optional(),
  position: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().length(2).toUpperCase().optional().or(z.literal('')),
  password: passwordField,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

type Actor = 'USER' | 'ADMIN';

interface Credentialed {
  id: string;
  passwordHash: string;
  active: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
}

/** Verifica credenciais com bloqueio temporário após tentativas excessivas. Mensagem genérica evita enumeração de contas. */
export async function authenticate<T extends Credentialed>(
  actor: Actor,
  req: Request,
  email: string,
  password: string,
  account: T | null,
  save: (id: string, data: { failedAttempts?: number; lockedUntil?: Date | null; lastLoginAt?: Date }) => Promise<unknown>,
): Promise<T> {
  const generic = unauthorized('E-mail ou senha incorretos');
  if (!account) {
    await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv').catch(() => false);
    await authLog(actor, email, false, req, 'conta inexistente');
    throw generic;
  }
  if (account.lockedUntil && account.lockedUntil > new Date()) {
    await authLog(actor, email, false, req, 'conta bloqueada');
    throw unauthorized('Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.');
  }
  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) {
    const attempts = account.failedAttempts + 1;
    await save(account.id, {
      failedAttempts: attempts >= MAX_ATTEMPTS ? 0 : attempts,
      lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
    });
    await authLog(actor, email, false, req, 'senha incorreta');
    throw generic;
  }
  if (!account.active) {
    await authLog(actor, email, false, req, 'conta desativada');
    throw unauthorized('Conta desativada. Entre em contato com o atendimento.');
  }
  await save(account.id, { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });
  await authLog(actor, email, true, req);
  return account;
}

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const cpf = onlyDigits(input.cpf);
  const dup = await prisma.user.findFirst({ where: { OR: [{ cpf }, { email: input.email }] } });
  if (dup) throw conflict(dup.cpf === cpf ? 'CPF já cadastrado' : 'E-mail já cadastrado');
  return prisma.user.create({
    data: {
      name: input.name,
      cpf,
      email: input.email,
      phone: input.phone,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      institution: input.institution || null,
      position: input.position || null,
      city: input.city || null,
      state: input.state || null,
      passwordHash: await hashPassword(input.password),
    },
  });
}

/**
 * Gera token de redefinição (armazenado apenas como hash, validade de 1h).
 * O envio de e-mail depende de integração SMTP ainda não configurada: em desenvolvimento o token é devolvido
 * para permitir testar o fluxo; em produção nada é exposto.
 */
export async function createResetToken(kind: Actor, email: string) {
  const account =
    kind === 'USER'
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.admin.findUnique({ where: { email } });
  if (!account || !account.active) return null;
  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 3600_000),
      ...(kind === 'USER' ? { userId: account.id } : { adminId: account.id }),
    },
  });
  return token;
}

export async function resetPassword(kind: Actor, token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  const owner = kind === 'USER' ? record?.userId : record?.adminId;
  if (!record || !owner || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest('Link de redefinição inválido ou expirado');
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    kind === 'USER'
      ? prisma.user.update({ where: { id: owner }, data: { passwordHash, failedAttempts: 0, lockedUntil: null } })
      : prisma.admin.update({ where: { id: owner }, data: { passwordHash, failedAttempts: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('E-mail inválido') });
export const resetSchema = z.object({ token: z.string().min(10), password: passwordField });
