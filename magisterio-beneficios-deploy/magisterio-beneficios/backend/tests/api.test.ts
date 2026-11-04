import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

// Requer banco com seed aplicado (npm run db:dev + db:push + db:seed) e SEED_DEMO_DATA=true.
const app = createApp();
const H = { 'x-requested-with': 'magisterio-web' };
const adminPassword = process.env.SEED_SUPERADMIN_PASSWORD!;
const run = Date.now().toString().slice(-8);

function cpf(seed: number) {
  const base = String(300000000 + seed).split('').map(Number);
  const dv = (d: number[]) => { const r = (d.reduce((s, x, i) => s + x * (d.length + 1 - i), 0) * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(base);
  return [...base, d1, dv([...base, d1])].join('');
}

const userBody = (suffix: string, seed: number) => ({
  name: 'Professor de Teste', cpf: cpf(seed), email: `teste${suffix}@demo.invalid`,
  phone: '11999998888', password: 'Senha1234',
});

async function adminAgent(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/admin/auth/login').set(H).send({ email, password: adminPassword });
  expect(res.status).toBe(200);
  return agent;
}

describe('autenticação de usuários', () => {
  const body = userBody(run, Number(run));

  it('bloqueia mutações sem cabeçalho CSRF', async () => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(403);
  });

  it('cadastra, impede duplicidade e autentica', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/register').set(H).send(body)).status).toBe(201);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await request(app).post('/api/auth/register').set(H).send(body)).status).toBe(409);
    expect((await request(app).post('/api/auth/register').set(H).send({ ...body, email: 'x@demo.invalid' })).status).toBe(409);
    expect((await request(app).post('/api/auth/register').set(H).send({ ...body, cpf: '11111111111' })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').set(H).send({ email: body.email, password: 'errada123A' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').set(H).send({ email: body.email, password: body.password })).status).toBe(200);
  });

  it('exige sessão nas rotas da área do usuário', async () => {
    expect((await request(app).get('/api/me/applications')).status).toBe(401);
    expect((await request(app).get('/api/me/profile')).status).toBe(401);
  });

  it('bloqueia a conta após tentativas excessivas', async () => {
    const b = userBody(`lock${run}`, Number(run) + 1);
    await request(app).post('/api/auth/register').set(H).send(b);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').set(H).send({ email: b.email, password: 'Errada123' });
    }
    const res = await request(app).post('/api/auth/login').set(H).send({ email: b.email, password: b.password });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/bloqueada/);
  });
});

describe('autorização administrativa (RBAC no backend)', () => {
  it('rejeita acesso sem login', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
  });

  it('não aceita sessão de usuário comum como administrador', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set(H).send({ email: 'usuario01@demo.invalid', password: 'Demo@12345' });
    expect((await agent.get('/api/admin/users')).status).toBe(401);
  });

  it('operador consulta e analisa, mas não gerencia administradores/configurações/benefícios', async () => {
    const op = await adminAgent('operador.demo@magisterio.local');
    expect((await op.get('/api/admin/users')).status).toBe(200);
    expect((await op.get('/api/admin/applications')).status).toBe(200);
    expect((await op.get('/api/admin/admins')).status).toBe(403);
    expect((await op.get('/api/admin/settings')).status).toBe(403);
    expect((await op.put('/api/admin/users/x').set(H).send({})).status).toBe(403);
    expect((await op.post('/api/admin/benefits').set(H).send({})).status).toBe(403);
    expect((await op.get('/api/admin/activities')).status).toBe(403);
  });

  it('admin gerencia benefícios mas não administradores', async () => {
    const ad = await adminAgent('admin.demo@magisterio.local');
    expect((await ad.get('/api/admin/benefits')).status).toBe(200);
    expect((await ad.get('/api/admin/admins')).status).toBe(403);
    expect((await ad.get('/api/admin/settings')).status).toBe(403);
  });

  it('super admin acessa tudo e atividades são registradas', async () => {
    const sa = await adminAgent('superadmin@magisterio.local');
    expect((await sa.get('/api/admin/admins')).status).toBe(200);
    expect((await sa.get('/api/admin/settings')).status).toBe(200);
    const acts = await sa.get('/api/admin/activities');
    expect(acts.status).toBe(200);
    expect(acts.body.total).toBeGreaterThan(0);
    // auditoria é somente leitura
    expect((await sa.put('/api/admin/activities/x').set(H).send({})).status).toBe(404);
    expect((await sa.delete('/api/admin/activities/x').set(H)).status).toBe(404);
  });

  it('não permite desativar a própria conta nem o último super admin', async () => {
    const sa = await adminAgent('superadmin@magisterio.local');
    const me = await sa.get('/api/admin/auth/me');
    const res = await sa.post(`/api/admin/admins/${me.body.id}/active`).set(H).send({ active: false });
    expect(res.status).toBe(400);
  });
});

describe('benefícios e solicitações (fluxo completo)', () => {
  let benefitId = '';
  let applicationId = '';
  const user = userBody(`app${run}`, Number(run) + 2);

  beforeAll(async () => {
    const b = await prisma.benefit.findFirst({ where: { status: 'PUBLISHED' } });
    benefitId = b!.id;
  });

  it('administrador cria, publica e exclui benefício sem vínculos; bloqueia exclusão com vínculos', async () => {
    const ad = await adminAgent('admin.demo@magisterio.local');
    const cat = await prisma.benefitCategory.findFirstOrThrow();
    const created = await ad.post('/api/admin/benefits').set(H).send({
      name: `Benefício teste ${run}`, summary: 'Resumo do benefício de teste', description: 'Descrição longa do benefício de teste.',
      categoryId: cat.id, targetAudience: 'Professores', requiredDocuments: 'Documento com foto', requirements: ['Requisito A'],
    });
    expect(created.status).toBe(201);
    expect((await ad.post(`/api/admin/benefits/${created.body.id}/publish`).set(H)).body.status).toBe('PUBLISHED');
    expect((await request(app).get(`/api/public/benefits/${created.body.slug}`)).status).toBe(200);
    expect((await ad.post(`/api/admin/benefits/${created.body.id}/unpublish`).set(H)).body.status).toBe('UNPUBLISHED');
    expect((await request(app).get(`/api/public/benefits/${created.body.slug}`)).status).toBe(404);
    expect((await ad.delete(`/api/admin/benefits/${created.body.id}`).set(H)).status).toBe(200);

    const withApps = await prisma.application.findFirstOrThrow({});
    expect((await ad.delete(`/api/admin/benefits/${withApps.benefitId}`).set(H)).status).toBe(409);
  });

  it('usuário cria solicitação e não pode duplicar', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').set(H).send(user);
    const res = await agent.post('/api/me/applications').set(H).send({ benefitId });
    expect(res.status).toBe(201);
    applicationId = res.body.id;
    expect((await agent.post('/api/me/applications').set(H).send({ benefitId })).status).toBe(409);

    // outro usuário não acessa a solicitação
    const other = request.agent(app);
    await other.post('/api/auth/login').set(H).send({ email: 'usuario01@demo.invalid', password: 'Demo@12345' });
    expect((await other.get(`/api/me/applications/${applicationId}`)).status).toBe(403);
  });

  it('administrador altera situação com histórico e regras de transição', async () => {
    const ad = await adminAgent('operador.demo@magisterio.local');
    expect((await ad.post(`/api/admin/applications/${applicationId}/status`).set(H).send({ status: 'CONCLUIDA' })).status).toBe(400);
    expect((await ad.post(`/api/admin/applications/${applicationId}/status`).set(H).send({ status: 'RECUSADA' })).status).toBe(400);
    expect((await ad.post(`/api/admin/applications/${applicationId}/status`).set(H).send({ status: 'EM_ANALISE' })).status).toBe(200);
    expect((await ad.post(`/api/admin/applications/${applicationId}/status`).set(H)
      .send({ status: 'AGUARDANDO_DOCUMENTACAO', note: 'Envie o comprovante de vínculo' })).status).toBe(200);
    expect((await ad.post(`/api/admin/applications/${applicationId}/notes`).set(H).send({ note: 'Nota interna', visibleToUser: false })).status).toBe(201);

    const detail = await ad.get(`/api/admin/applications/${applicationId}`);
    expect(detail.body.history.length).toBeGreaterThanOrEqual(4);
    const change = detail.body.history.find(
      (h: { toStatus: string; fromStatus: string }) => h.toStatus === 'AGUARDANDO_DOCUMENTACAO' && h.fromStatus === 'EM_ANALISE',
    );
    expect(change.admin.name).toBeTruthy();
    expect(change.createdAt).toBeTruthy();
  });

  it('usuário não vê notas internas e envia documento válido (rejeita inválido)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set(H).send({ email: user.email, password: user.password });
    const detail = await agent.get(`/api/me/applications/${applicationId}`);
    expect(detail.body.history.some((h: { note: string }) => h.note === 'Nota interna')).toBe(false);

    const bad = await agent.post(`/api/me/applications/${applicationId}/documents`).set(H)
      .attach('file', Buffer.from('MZ-executavel'), 'virus.pdf');
    expect(bad.status).toBe(400);

    const ok = await agent.post(`/api/me/applications/${applicationId}/documents`).set(H)
      .attach('file', Buffer.from('%PDF-1.4 conteudo de teste'), 'comprovante.pdf');
    expect(ok.status).toBe(201);
    const after = await agent.get(`/api/me/applications/${applicationId}`);
    expect(after.body.status).toBe('EM_ANALISE');
  });
});
