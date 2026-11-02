import { describe, expect, it } from 'vitest';
import { isValidCpf, passwordPolicy, slugify } from '../src/common/utils';
import { TRANSITIONS, validateTransition } from '../src/modules/applications/applications.service';
import { ROLES } from '../src/common/permissions';

describe('regras puras', () => {
  it('valida CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
  });

  it('exige senha forte', () => {
    expect(passwordPolicy.test('fraca')).toBe(false);
    expect(passwordPolicy.test('Forte123')).toBe(true);
  });

  it('gera slug sem acentos', () => {
    expect(slugify('Auxílio Material Didático')).toBe('auxilio-material-didatico');
  });

  it('estados finais não possuem transições', () => {
    expect(TRANSITIONS.RECUSADA).toEqual([]);
    expect(TRANSITIONS.CONCLUIDA).toEqual([]);
  });

  it('valida transições de solicitação', () => {
    expect(() => validateTransition('PENDENTE', 'EM_ANALISE')).not.toThrow();
    expect(() => validateTransition('PENDENTE', 'CONCLUIDA')).toThrow();
    expect(() => validateTransition('RECUSADA', 'APROVADA')).toThrow();
    expect(() => validateTransition('EM_ANALISE', 'RECUSADA')).toThrow(/motivo/);
    expect(() => validateTransition('EM_ANALISE', 'RECUSADA', 'Documento ilegível')).not.toThrow();
    expect(() => validateTransition('EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO')).toThrow(/documentos/);
  });

  it('operador não gerencia administradores nem configurações', () => {
    expect(ROLES.OPERADOR.permissions).not.toContain('admins:manage');
    expect(ROLES.OPERADOR.permissions).not.toContain('settings:write');
    expect(ROLES.ADMIN.permissions).not.toContain('admins:manage');
    expect(ROLES.SUPER_ADMIN.permissions).toContain('admins:manage');
  });
});
