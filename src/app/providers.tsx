'use client';

import { AuthProvider } from '@/lib/auth-context';
import ForceContactModal from '@/components/ForceContactModal';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ForceContactModal />
    </AuthProvider>
  );
}
