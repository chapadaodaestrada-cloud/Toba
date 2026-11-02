import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Settings } from '../types';

export function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export const useSettings = () =>
  useQuery({ queryKey: ['public', 'settings'], queryFn: () => api.get<Settings>('/public/settings'), staleTime: 5 * 60_000 });

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Magistério Benefícios`;
  }, [title]);
}
