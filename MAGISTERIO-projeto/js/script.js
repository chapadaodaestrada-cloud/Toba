const P={
home:'<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
calc:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8"/>',
file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
award:'<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 23l5-3 5 3-1.2-9.1"/>',
plus:'<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
ref:'<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 15-3.4L23 10M1 14l4.5 4.4A9 9 0 0 0 20.5 15"/>',
shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'};
const ic=n=>`<svg class="i" viewBox="0 0 24 24">${P[n]}</svg>`;
const $=id=>document.getElementById(id);
const B=[
{n:'Benefício de Valorização Profissional',d:'Reconhecimento por tempo de dedicação e formação continuada.',v:1850,s:'Ativo',i:'award'},
{n:'Auxílio Complementar do Magistério',d:'Apoio mensal complementar para despesas educacionais.',v:620.5,s:'Ativo',i:'plus'},
{n:'Benefício de Aposentadoria',d:'Simulação ilustrativa de proventos de aposentadoria.',v:4380.9,s:'Em análise',i:'clock'},
{n:'Revisão de Benefícios',d:'Acompanhamento de pedidos de revisão cadastral.',v:310,s:'Pendente',i:'ref'},
{n:'Complementação Previdenciária',d:'Valor complementar fictício para composição de renda.',v:940.75,s:'Ativo',i:'shield'},
{n:'Valores a Receber',d:'Área ilustrativa com valores fictícios. Não há saldo real.',v:1275.4,s:'Demonstrativo',i:'cash'},
{n:'Consulta de Valores',d:'Consulte composições e extratos totalmente ilustrativos.',v:0,s:'Disponível',i:'calc'}];
const H=[];
const N=[
['Novo extrato demonstrativo disponível para consulta.','Há 2 horas'],
['Atualize seus dados cadastrais de exemplo.','3 dias atrás'],
['Bem-vindo(a) ao protótipo do portal MAGISTÉRIO.','1 semana atrás']];
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cls=s=>({'Ativo':'ok','Concluída':'ok','Disponível':'ok','Em análise':'an','Pendente':'pe','Recusada':'no'}[s]||'pe');
const pill=s=>`<span class="pill s-${cls(s)}">${s}</span>`;
const tbl=r=>!r.length?'<p style="color:var(--mut);margin:0">Nenhuma solicitação realizada ainda. Quando você fizer uma solicitação, ela aparecerá aqui.</p>':`<div class="tw"><table class="st"><thead><tr><th>Protocolo</th><th>Solicitação</th><th>Data</th><th>Status</th></tr></thead><tbody>${r.map(x=>`<tr><td data-l="Protocolo">${x[0]}</td><td data-l="Solicitação">${x[1]}</td><td data-l="Data">${x[2]}</td><td data-l="Status">${pill(x[3])}</td></tr>`).join('')}</tbody></table></div>`;
const nts=()=>N.map(x=>`<div class="nt"><i class="dot"></i><div>${x[0]}<span>${x[1]}</span></div></div>`).join('');
let user='',pre=0,seq=0,msg='';
function addReq(n){seq++;H.unshift(['DEMO-'+new Date().getFullYear()+'-'+String(seq).padStart(4,'0'),n,new Date().toLocaleDateString('pt-BR'),'Em análise']);N.unshift(['Sua solicitação de “'+n+'” foi registrada (fictícia).','Agora']);msg='Solicitação de <b>'+n+'</b> registrada com sucesso. Em até 24 horas úteis seu pedido será analisado por nossos agentes (simulação).';}
const V={
home:()=>`<div class="card welcome anim"><div><h3>Bem-vindo(a), ${user}!</h3><p>Este é o seu painel demonstrativo. Explore benefícios, consultas e solicitações fictícias.</p></div><span class="chip">● Sessão demonstrativa</span></div>
<div class="grid g3"><div class="card stat anim"><small>Benefícios ativos</small><strong>3</strong></div><div class="card stat anim"><small>Total ilustrativo / mês</small><strong class="g">${brl(3411.25)}</strong></div><div class="card stat anim"><small>Solicitações em análise</small><strong>${H.filter(x=>x[3]==='Em análise').length}</strong></div></div>
<div class="grid g2"><div class="card anim"><h4>${ic('bell')} Notificações</h4>${nts()}</div><div class="card anim"><h4>${ic('file')} Histórico recente</h4>${tbl(H.slice(0,4))}</div></div>`,
ben:()=>`<h3 class="t">Benefícios</h3><p class="lead">Categorias ilustrativas. Valores e status são fictícios.</p><div class="grid gb">${B.map((b,k)=>`<div class="card bc anim" style="animation-delay:${k*60}ms"><div class="row"><div class="ic">${ic(b.i)}</div>${pill(b.s)}</div><h5>${b.n}</h5><p>${b.d}</p><div class="v">${b.v?brl(b.v):'—'} <small style="font-size:.7rem;color:var(--mut);font-weight:400">ilustrativo</small></div><button class="b2" data-q="${k}">Consultar</button></div>`).join('')}</div>`,
val:()=>`<h3 class="t">Consulta de Valores Demonstrativos</h3><p class="lead">Selecione um item para gerar uma composição fictícia.</p>
<div class="card anim"><div class="qf"><div><label for="sb">Categoria</label><select id="sb">${B.slice(0,6).map((b,k)=>`<option value="${k}">${b.n}</option>`).join('')}</select></div><div><label for="sm">Competência</label><select id="sm"><option>Outubro/2026</option><option>Setembro/2026</option><option>Agosto/2026</option></select></div><button class="btn" id="gq">CONSULTAR</button></div><div class="res" id="res"><p style="color:var(--mut)">Nenhuma consulta realizada.</p></div></div>`,
sol:()=>`<h3 class="t">Solicitações</h3><p class="lead">Faça uma solicitação fictícia e acompanhe o histórico aqui.</p><div class="card anim" style="margin-bottom:20px"><h4>${ic('plus')} Nova solicitação</h4><div class="qf" style="margin-bottom:0"><div><label for="rb">Categoria</label><select id="rb">${B.slice(0,6).map((b,k)=>`<option value="${k}">${b.n}</option>`).join('')}</select></div><span></span><button class="btn" id="rq">SOLICITAR</button></div></div><div class="card anim"><h4>${ic('file')} Histórico</h4>${tbl(H)}</div>`,
not:()=>`<h3 class="t">Notificações</h3><p class="lead">Mensagens de exemplo.</p><div class="card anim">${nts()}</div>`};
const M=[['home','Início','home'],['ben','Benefícios','grid'],['val','Consulta de Valores','calc'],['sol','Solicitações','file'],['not','Notificações','bell']];
function go(k){
  $('view').innerHTML=(k==='sol'&&msg?`<div class="okmsg anim">${ic('clock')}<div>${msg}</div></div>`:'')+V[k]();
  if(k==='sol')msg='';
  document.querySelectorAll('#nav button,#bn button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
  $('side').classList.remove('open');$('scrim').classList.remove('open');window.scrollTo({top:0});
  document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{pre=+b.dataset.q;go('val');if(pre<6)$('sb').value=pre;});
  if(k==='val')$('gq').onclick=()=>{
    const b=B[+$('sb').value],a=b.v,x=[['Valor base',a*.82],['Adicional por tempo (fictício)',a*.14],['Gratificação de exemplo',a*.04],['Desconto ilustrativo',-a*.06]];
    $('res').innerHTML=`<div class="anim tw"><table><thead><tr><th>Componente</th><th style="text-align:right">Valor</th></tr></thead><tbody>${x.map(r=>`<tr><td>${r[0]}</td><td style="text-align:right">${brl(r[1])}</td></tr>`).join('')}</tbody></table><div class="tot"><span>Total ilustrativo — ${$('sm').value}</span><span>${brl(a*.94)}</span></div><p class="warn">Valores fictícios. Não representam benefício real nem valor a receber.</p><button class="btn" id="rv" style="width:auto;padding:12px 24px;margin-top:14px">SOLICITAR ESTE BENEFÍCIO</button></div>`;$('rv').onclick=()=>{addReq(b.n);go('sol')};};
  if(k==='sol')$('rq').onclick=()=>{addReq(B[+$('rb').value].n);go('sol')};
}
$('iu').innerHTML=ic('user');$('ip').innerHTML=ic('lock');$('eye').innerHTML=ic('eye');$('bg').innerHTML=ic('menu');$('lo').innerHTML=ic('out')+' Sair';
$('nav').innerHTML=M.map(m=>`<button data-k="${m[0]}">${ic(m[2])}${m[1]}</button>`).join('');
$('nav').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.k)};
const BL=['Início','Benefícios','Valores','Pedidos','Avisos'];
$('bn').innerHTML=M.map((m,k)=>`<button data-k="${m[0]}">${ic(m[2])}${BL[k]}</button>`).join('');
$('bn').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.k)};
$('eye').onclick=()=>{const p=$('p');p.type=p.type==='password'?'text':'password'};
$('lf').onsubmit=e=>{
  e.preventDefault();const u=$('u').value.trim(),p=$('p').value;
  if(!u||!p){$('err').textContent='Preencha o nome de usuário e a senha para continuar.';return}
  user=u.split(' ')[0];user=user.charAt(0).toUpperCase()+user.slice(1);
  $('who').textContent=u;$('av').textContent=u.charAt(0).toUpperCase();
  $('login').classList.add('hidden');$('app').classList.remove('hidden');go('home');
};
$('lo').onclick=()=>{$('app').classList.add('hidden');$('login').classList.remove('hidden');$('p').value='';$('err').textContent=''};
$('bg').onclick=()=>{$('side').classList.add('open');$('scrim').classList.add('open')};
$('scrim').onclick=()=>{$('side').classList.remove('open');$('scrim').classList.remove('open')};
