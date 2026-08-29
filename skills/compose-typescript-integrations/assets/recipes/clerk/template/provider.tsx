import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

export function AppAuthProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
