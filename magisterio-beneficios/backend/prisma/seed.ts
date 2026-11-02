import 'dotenv/config';
import { PrismaClient, type ApplicationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLES } from '../src/common/permissions';
import { slugify } from '../src/common/utils';

const prisma = new PrismaClient();

function makeCpf(seed: number) {
  const base = String(100000000 + seed * 7919).slice(0, 9).split('').map(Number);
  const dv = (digits: number[]) => {
    const len = digits.length + 1;
    const sum = digits.reduce((s, d, i) => s + d * (len - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join('');
}

async function seedAccess() {
  for (const [key, label] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: { label }, create: { key, label } });
  }
  for (const [key, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { key }, update: { name: def.name, description: def.description },
      create: { key, name: def.name, description: def.description },
    });
    // Só define permissões na criação: alterações feitas pelo painel não são sobrescritas.
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0) {
      const perms = await prisma.permission.findMany({ where: { key: { in: def.permissions } } });
      await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    }
  }
  await prisma.platformSettings.upsert({
    where: { id: 1 }, update: {},
    create: {
      id: 1,
      about: 'O Magistério Benefícios é uma plataforma institucional independente que reúne informações e facilita solicitações de benefícios para profissionais da educação. Não é um órgão governamental nem uma entidade pública oficial.',
      contactEmail: 'contato@magisterio.example',
      contactPhone: '(00) 0000-0000',
      address: 'Endereço a ser configurado',
    },
  });
}

async function seedSuperAdmin() {
  const email = (process.env.SEED_SUPERADMIN_EMAIL ?? 'superadmin@magisterio.local').toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!password || password.length < 10) {
    console.warn('[seed] SEED_SUPERADMIN_PASSWORD ausente (mín. 10 caracteres): administrador inicial NÃO foi criado.');
    return null;
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
  const admin = await prisma.admin.upsert({
    where: { email }, update: {},
    create: { name: 'Super Administrador', email, roleId: role.id, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`[seed] SUPER_ADMIN: ${email}`);
  return { admin, password };
}

async function seedDemo(superAdminId: string, adminPassword: string) {
  const [roleAdmin, roleOp] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { key: 'ADMIN' } }),
    prisma.role.findUniqueOrThrow({ where: { key: 'OPERADOR' } }),
  ]);
  const hash = await bcrypt.hash(adminPassword, 12);
  await prisma.admin.upsert({ where: { email: 'admin.demo@magisterio.local' }, update: {}, create: { name: 'Administrador Demonstrativo', email: 'admin.demo@magisterio.local', roleId: roleAdmin.id, passwordHash: hash } });
  await prisma.admin.upsert({ where: { email: 'operador.demo@magisterio.local' }, update: {}, create: { name: 'Operador Demonstrativo', email: 'operador.demo@magisterio.local', roleId: roleOp.id, passwordHash: hash } });

  const catNames = ['Saúde e bem-estar', 'Educação e formação', 'Financeiro', 'Lazer e convênios'];
  const cats = [];
  for (const name of catNames) {
    cats.push(await prisma.benefitCategory.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } }));
  }
  const demoNote = ' (Conteúdo demonstrativo para ambiente de desenvolvimento.)';
  const benefits = [
    ['Orientação em saúde e bem-estar', 0, 'Canal de orientação sobre planos e programas de saúde voltados a profissionais da educação.'],
    ['Apoio à formação continuada', 1, 'Informações e apoio para cursos de aperfeiçoamento e especialização.'],
    ['Consulta de margem e orientação financeira', 2, 'Orientação sobre educação financeira e análise de condições de crédito consignado.'],
    ['Clube de convênios e descontos', 3, 'Rede de parceiros com condições especiais para associados.'],
    ['Auxílio material didático', 1, 'Apoio para aquisição de material didático e recursos pedagógicos.'],
  ] as const;
  const created = [];
  for (const [name, c, summary] of benefits) {
    const slug = slugify(name);
    created.push(await prisma.benefit.upsert({
      where: { slug }, update: {},
      create: {
        name, slug, summary, categoryId: cats[c].id, status: 'PUBLISHED',
        description: `${summary} Consulte requisitos e documentação antes de solicitar.${demoNote}`,
        targetAudience: 'Professores e demais profissionais da educação em exercício.',
        requiredDocuments: 'Documento de identificação com foto; comprovante de vínculo profissional; comprovante de residência.',
        requirements: { create: [
          { text: 'Possuir vínculo ativo com instituição de ensino', position: 0 },
          { text: 'Cadastro completo e atualizado na plataforma', position: 1 },
        ] },
      },
    }));
  }

  const newsCat = await prisma.newsCategory.upsert({ where: { slug: 'comunicados' }, update: {}, create: { name: 'Comunicados', slug: 'comunicados' } });
  const newsCat2 = await prisma.newsCategory.upsert({ where: { slug: 'orientacoes' }, update: {}, create: { name: 'Orientações', slug: 'orientacoes' } });
  const news = [
    ['Bem-vindo ao portal Magistério Benefícios', newsCat.id, 'Conheça a plataforma e como solicitar benefícios.'],
    ['Como acompanhar suas solicitações', newsCat2.id, 'Passo a passo para consultar a situação de cada pedido.'],
    ['Atualize seu cadastro profissional', newsCat2.id, 'Manter os dados atualizados agiliza a análise.'],
  ] as const;
  for (const [title, categoryId, excerpt] of news) {
    const slug = slugify(title);
    await prisma.news.upsert({
      where: { slug }, update: {},
      create: {
        title, slug, categoryId, excerpt, status: 'PUBLISHED', publishedAt: new Date(), authorId: superAdminId,
        content: `${excerpt}\n\n## Detalhes\n\nTexto demonstrativo para o ambiente de desenvolvimento.\n\n- Item de exemplo um\n- Item de exemplo dois`,
      },
    });
  }

  const userHash = await bcrypt.hash('Demo@12345', 12);
  const statuses: ApplicationStatus[] = ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO', 'APROVADA', 'RECUSADA', 'CONCLUIDA'];
  for (let i = 1; i <= 12; i++) {
    const n = String(i).padStart(2, '0');
    const email = `usuario${n}@demo.invalid`;
    const createdAt = new Date(Date.now() - (i % 6) * 30 * 86400_000 - i * 3600_000);
    const user = await prisma.user.upsert({
      where: { email }, update: {},
      create: {
        name: `Usuário Demonstrativo ${n}`, cpf: makeCpf(i), email, phone: `1199999${String(1000 + i)}`,
        institution: 'Escola Demonstrativa', position: 'Professor(a)', city: 'Cidade Exemplo', state: 'SP',
        passwordHash: userHash, createdAt,
      },
    });
    if (await prisma.application.count({ where: { userId: user.id } })) continue;
    const status = statuses[i % statuses.length];
    const benefit = created[i % created.length];
    await prisma.application.create({
      data: {
        protocol: `MB-DEMO-${n}`, userId: user.id, benefitId: benefit.id, status, createdAt,
        history: { create: [
          { toStatus: 'PENDENTE', note: 'Solicitação registrada', userId: user.id, createdAt },
          ...(status !== 'PENDENTE' ? [{ fromStatus: 'PENDENTE' as const, toStatus: status, note: 'Atualização demonstrativa', adminId: superAdminId }] : []),
        ] },
      },
    });
  }
  console.log('[seed] Dados demonstrativos criados (usuários usuarioNN@demo.invalid / senha de demonstração Demo@12345).');
}

async function main() {
  await seedAccess();
  const sa = await seedSuperAdmin();
  if (sa && process.env.SEED_DEMO_DATA === 'true') {
    if (process.env.NODE_ENV === 'production') throw new Error('SEED_DEMO_DATA não pode ser usado em produção');
    await seedDemo(sa.admin.id, sa.password);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
