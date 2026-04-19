import { CopilotProvider } from "@/components/CopilotProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CopilotProvider>{children}</CopilotProvider>;
}
