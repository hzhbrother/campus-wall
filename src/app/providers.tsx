'use client';

import { AuthProvider } from '@/lib/auth-context';
import EmailBindPrompt from '@/components/EmailBindPrompt';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <EmailBindPrompt />
    </AuthProvider>
  );
}
