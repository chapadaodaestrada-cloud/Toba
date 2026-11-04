# Deploy gratuito: Render + Neon

O backend serve também o site (`frontend/dist`), então tudo roda em **um único serviço** e no mesmo domínio.

## Limitações do plano gratuito
- O serviço **dorme após 15 min sem acesso**; o primeiro acesso depois disso leva cerca de 1 minuto.
- O Neon suspende o banco quando ocioso; a primeira consulta pode demorar alguns segundos.
- **Uploads de documentos são perdidos** quando o serviço reinicia (sem disco persistente).
- Serve para demonstração/homologação, não para uso real com dados pessoais.

## 1. Banco de dados (Neon)
1. Crie uma conta em neon.com e um projeto (região mais próxima possível).
2. Em **Connect**, desative a opção *Connection pooling* e copie a string (host **sem** `-pooler`). Ela termina com `?sslmode=require`.

## 2. Preparar o banco (na sua máquina, uma única vez)
Com Node 20+ instalado:
```bash
cd backend
npm install
```
Crie o arquivo `backend/.env` (a partir de `.env.example`) com a `DATABASE_URL` do Neon e defina `SEED_SUPERADMIN_PASSWORD` com uma senha forte. Depois:
```bash
npm run db:generate
npm run db:deploy      # cria as tabelas
npm run db:seed        # perfis, permissões e SUPER_ADMIN
```
- Para popular **dados demonstrativos** (usuários e benefícios fictícios), deixe `NODE_ENV=development` e `SEED_DEMO_DATA=true` no `.env` ao rodar o seed. O seed recusa dados demonstrativos com `NODE_ENV=production`.
- Atenção: os usuários demonstrativos usam a senha `Demo@12345`, pública neste repositório. Não use com dados reais.

## 3. GitHub
Crie um repositório **privado** e envie o projeto (o `.gitignore` já exclui `.env` e `node_modules`).
```bash
git init && git add . && git commit -m "Magistério Benefícios"
git branch -M main
git remote add origin <URL-DO-SEU-REPOSITORIO>
git push -u origin main
```

## 4. Render
1. Em render.com: **New > Blueprint**, conecte o repositório. Ele lê o `render.yaml`.
2. Preencha:
   - `DATABASE_URL`: a mesma string do Neon (sem pooler).
   - `CORS_ORIGIN`: `https://NOME-DO-SERVICO.onrender.com` (o endereço aparece após criar; se ainda não souber, deixe um valor provisório, crie, e atualize em *Environment*).
3. Aguarde o build. O serviço roda as migrations ao iniciar.
4. Acesse `https://NOME-DO-SERVICO.onrender.com` e o painel em `/admin`.

## Se o build falhar
- Erro de versão do Node: em *Environment*, ajuste `NODE_VERSION` (o projeto foi testado com Node 26; o `render.yaml` usa 22).
- Erro de migrations/conexão: confira se a `DATABASE_URL` é a direta (sem `-pooler`) e termina com `sslmode=require`.
- Login não persiste: confirme `COOKIE_SECURE=true` e acesso por HTTPS.

## Evitar o "sono" (opcional)
Um monitor gratuito (ex.: UptimeRobot) chamando `https://SEU-SERVICO.onrender.com/api/health` a cada 5 minutos mantém o serviço acordado. O plano gratuito tem um limite mensal de horas de instância; confira na documentação do Render.
