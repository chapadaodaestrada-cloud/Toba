export const PERMISSIONS = {
  'users:read': 'Consultar usuários',
  'users:write': 'Editar e ativar/desativar usuários',
  'benefits:read': 'Consultar benefícios',
  'benefits:write': 'Gerenciar benefícios',
  'applications:read': 'Consultar solicitações',
  'applications:review': 'Analisar solicitações',
  'news:read': 'Consultar notícias',
  'news:write': 'Gerenciar notícias',
  'admins:manage': 'Gerenciar administradores',
  'activities:read': 'Consultar histórico de atividades',
  'settings:read': 'Consultar configurações',
  'settings:write': 'Alterar configurações',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const all = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLES: Record<string, { name: string; description: string; permissions: PermissionKey[] }> = {
  SUPER_ADMIN: {
    name: 'Super administrador',
    description: 'Acesso completo, incluindo administradores e configurações.',
    permissions: all,
  },
  ADMIN: {
    name: 'Administrador',
    description: 'Usuários, benefícios, solicitações e notícias.',
    permissions: [
      'users:read', 'users:write', 'benefits:read', 'benefits:write',
      'applications:read', 'applications:review', 'news:read', 'news:write', 'activities:read',
    ],
  },
  OPERADOR: {
    name: 'Operador',
    description: 'Atendimento: consulta de usuários e análise de solicitações.',
    permissions: ['users:read', 'benefits:read', 'applications:read', 'applications:review', 'news:read'],
  },
};
