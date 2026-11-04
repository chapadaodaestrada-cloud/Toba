import { Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { Logo } from '../components/common';
import { DemoBanner } from '../components/feedback';
import { Button } from '../components/ui';
import { useSettings } from '../hooks/common';
import { useUserAuth } from '../hooks/useAuth';

const links = [
  { to: '/', label: 'Início', end: true },
  { to: '/beneficios', label: 'Benefícios' },
  { to: '/servicos', label: 'Serviços' },
  { to: '/noticias', label: 'Notícias' },
  { to: '/institucional', label: 'Institucional' },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { data: s } = useSettings();
  const { me } = useUserAuth();
  const name = s?.platformName ?? 'Magistério Benefícios';

  return (
    <div className="flex min-h-screen flex-col">
      {s?.demoMode && <DemoBanner />}
      <div className="hidden bg-navy-900 text-xs text-navy-100 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5">
          <span>Plataforma institucional independente — não é órgão governamental.</span>
          <div className="flex gap-4">
            {s?.contactPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.contactPhone}</span>}
            {s?.contactEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.contactEmail}</span>}
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo name={name} suffix="Plataforma institucional" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) => clsx('rounded-md px-3 py-2 text-sm font-medium', isActive ? 'bg-navy-50 text-navy-800' : 'text-slate-600 hover:text-navy-800')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {me ? (
              <Link to="/minha-conta"><Button size="sm">Minha conta</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="secondary" size="sm">Entrar</Button></Link>
                <Link to="/cadastro"><Button size="sm">Cadastre-se</Button></Link>
              </>
            )}
          </div>
          <button className="rounded p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Abrir menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-slate-100 px-4 pb-4 md:hidden" aria-label="Principal móvel">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className="block border-b border-slate-100 py-3 text-sm font-medium text-slate-700">{l.label}</NavLink>
            ))}
            <div className="mt-3 flex gap-2">
              {me ? (
                <Link to="/minha-conta" className="flex-1" onClick={() => setOpen(false)}><Button className="w-full">Minha conta</Button></Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1" onClick={() => setOpen(false)}><Button variant="secondary" className="w-full">Entrar</Button></Link>
                  <Link to="/cadastro" className="flex-1" onClick={() => setOpen(false)}><Button className="w-full">Cadastre-se</Button></Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-navy-900 text-navy-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo light name={name} />
            <p className="mt-3 max-w-md text-sm text-navy-200">
              {s?.about || 'Plataforma institucional independente que facilita o acesso de profissionais da educação a informações e solicitações de benefícios.'}
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Navegação</h3>
            <ul className="space-y-2 text-sm">
              {links.map((l) => <li key={l.to}><Link className="hover:text-white" to={l.to}>{l.label}</Link></li>)}
              <li><Link className="hover:text-white" to="/admin">Acesso administrativo</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Contato</h3>
            <ul className="space-y-2 text-sm">
              {s?.contactEmail && <li className="flex items-center gap-2"><Mail className="h-4 w-4" />{s.contactEmail}</li>}
              {s?.contactPhone && <li className="flex items-center gap-2"><Phone className="h-4 w-4" />{s.contactPhone}</li>}
              {s?.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{s.address}</li>}
              {s?.instagram && <li><a className="hover:text-white" href={s.instagram} target="_blank" rel="noreferrer noopener">Instagram</a></li>}
              {s?.facebook && <li><a className="hover:text-white" href={s.facebook} target="_blank" rel="noreferrer noopener">Facebook</a></li>}
              {s?.youtube && <li><a className="hover:text-white" href={s.youtube} target="_blank" rel="noreferrer noopener">YouTube</a></li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-navy-800 px-4 py-4 text-center text-xs text-navy-200">
          © {new Date().getFullYear()} {name}. Plataforma institucional independente, sem vínculo com órgãos governamentais. Os dados pessoais são tratados conforme a LGPD.
        </div>
      </footer>
    </div>
  );
}
