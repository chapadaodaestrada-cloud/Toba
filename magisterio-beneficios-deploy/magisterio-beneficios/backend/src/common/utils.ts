import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function isValidCpf(raw: string) {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export const maskCpf = (cpf: string) => `***.${cpf.slice(3, 6)}.***-**`;

export const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
export const passwordMessage = 'A senha deve ter de 8 a 72 caracteres, com letra maiúscula, minúscula e número';
