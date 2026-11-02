# Publicação em produção

## Checklist obrigatório
1. **PostgreSQL gerenciado** (ou próprio) com backup. Defina `DATABASE_URL` sem `pgbouncer`/`connection_limit` (essas opções são só do banco embutido de desenvolvimento).
2. `backend/.env`: `NODE_ENV=production`, `JWT_USER_SECRET` e `JWT_ADMIN_SECRET` aleatórios (≥ 64 caracteres, diferentes), `COOKIE_SECURE=true`, `CORS_ORIGIN` com o domínio real, `DEMO_MODE=false`, `SEED_DEMO_DATA=false`.
3. **HTTPS** obrigatório (cookies `Secure`). Sirva o frontend e a API sob o mesmo domínio (ex.: `/api` via proxy reverso) — o frontend usa caminhos relativos `/api`.
4. Build e execução:
   ```bash
   cd backend && npm ci && npm run db:generate && npm run build && npm run db:deploy
   SEED_SUPERADMIN_PASSWORD='<senha forte>' npm run db:seed   # cria perfis, permissões e o SUPER_ADMIN
   npm start
   cd ../frontend && npm ci && npm run build                  # servir frontend/dist como estático, com fallback para index.html
   ```
5. Troque a senha inicial do SUPER_ADMIN e remova `SEED_SUPERADMIN_PASSWORD` do ambiente.
6. `UPLOAD_DIR` em volume persistente e com backup (documentos de professores — dados pessoais/LGPD).

## O que depende de terceiros (não implementado)
- **E-mail (SMTP)**: recuperação de senha gera o token, mas não envia e-mail; notificações são apenas preferências salvas.
- **Armazenamento de imagens/logotipo**: hoje por URL externa. Upload para S3/similar não foi implementado.
- **Antivírus em uploads**: apenas validação de tipo/assinatura e tamanho.
- **Política de privacidade / termos e retenção de dados (LGPD)**: textos e prazos devem ser definidos pela instituição.
- **Rate limit distribuído**: o limitador atual é em memória (uma instância). Com várias instâncias, use um store compartilhado (Redis).
- **2FA e monitoramento/alertas** de segurança.
- **Publicação programada de notícias** funciona por data na consulta (sem job); sem e-mail/push de aviso.
