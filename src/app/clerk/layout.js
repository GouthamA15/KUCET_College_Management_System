import { ClerkProvider } from '@/context/ClerkContext';

export default async function ClerkLayout({ children }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}