"use client";

import { CopilotKitProvider } from "@copilotkitnext/react";
import { ReactNode } from "react";

export function CopilotProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      showDevConsole={false}
    >
      {children}
    </CopilotKitProvider>
  );
}
