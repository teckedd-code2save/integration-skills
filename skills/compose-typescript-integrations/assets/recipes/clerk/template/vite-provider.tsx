import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";

function publishableKey() {
  const value = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!value) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not configured");
  return value;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider publishableKey={publishableKey()}>{children}</ClerkProvider>;
}
