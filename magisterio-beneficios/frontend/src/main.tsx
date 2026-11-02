import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/feedback';
import { AdminAuthProvider, UserAuthProvider } from './hooks/useAuth';
import { ApiError } from './services/api';
import { router } from './routes';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UserAuthProvider>
          <AdminAuthProvider>
            <RouterProvider router={router} />
          </AdminAuthProvider>
        </UserAuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
