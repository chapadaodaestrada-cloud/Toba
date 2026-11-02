import { z } from 'zod';

const digits = (v: string) => v.replace(/\D/g, '');

export function isValidCpf(raw: string) {
  const cpf = digits(raw);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export const password = z
  .string()
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/, 'A senha deve ter ao menos 8 caracteres, com maiúscula, minúscula e número');

const email = z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido');
const phone = z.string().refine((v) => [10, 11].includes(digits(v).length), 'Telefone inválido (com DDD)');

export const loginSchema = z.object({ email, password: z.string().min(1, 'Informe a senha') });

export const profileFields = {
  name: z.string().trim().min(5, 'Informe o nome completo'),
  phone,
  birthDate: z.string().optional(),
  institution: z.string().optional(),
  position: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
};

export const registerSchema = z
  .object({
    ...profileFields,
    cpf: z.string().refine(isValidCpf, 'CPF inválido'),
    email,
    password,
    confirmPassword: z.string(),
    accept: z.boolean().refine((v) => v, 'É necessário aceitar o tratamento de dados'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' });

export const profileSchema = z.object(profileFields);
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: password, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' });

export const benefitSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome'),
  summary: z.string().trim().min(10, 'Informe um resumo (mín. 10 caracteres)').max(300),
  description: z.string().trim().min(20, 'Descreva o benefício (mín. 20 caracteres)'),
  categoryId: z.string().min(1, 'Selecione a categoria'),
  targetAudience: z.string().trim().min(3, 'Informe o público elegível'),
  requiredDocuments: z.string().trim().min(3, 'Informe a documentação'),
  imageUrl: z.string().trim().url('URL inválida').or(z.literal('')),
  startDate: z.string(),
  endDate: z.string(),
  requirements: z.string(),
}).refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, { path: ['endDate'], message: 'Deve ser posterior ao início' });

export const newsSchema = z.object({
  title: z.string().trim().min(5, 'Informe o título'),
  excerpt: z.string().trim().min(10, 'Informe um resumo').max(300),
  content: z.string().trim().min(20, 'Escreva o conteúdo (mín. 20 caracteres)'),
  categoryId: z.string().min(1, 'Selecione a categoria'),
  imageUrl: z.string().trim().url('URL inválida').or(z.literal('')),
  scheduledFor: z.string(),
});

export const adminSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome'),
  email,
  roleKey: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERADOR']),
  password: z.string().refine((v) => v === '' || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(v), 'Mín. 8 caracteres, com maiúscula, minúscula e número'),
});

export const settingsSchema = z.object({
  platformName: z.string().trim().min(3, 'Informe o nome'),
  logoUrl: z.string().trim().url('URL inválida').or(z.literal('')),
  about: z.string().max(2000),
  contactEmail: z.string().email('E-mail inválido').or(z.literal('')),
  contactPhone: z.string().max(30),
  address: z.string().max(250),
  instagram: z.string().url('URL inválida').or(z.literal('')),
  facebook: z.string().url('URL inválida').or(z.literal('')),
  youtube: z.string().url('URL inválida').or(z.literal('')),
  maxUploadMb: z.coerce.number().int().min(1, 'Mín. 1').max(10, 'Máx. 10'),
  notifyNewApplication: z.boolean(),
  notifyStatusChange: z.boolean(),
  maintenanceMode: z.boolean(),
});
