/**
 * MCP Server Configuration
 *
 * Add MCP servers here or configure via MCP_SERVERS env var.
 * Each server exposes tools available to the CopilotKit runtime automatically.
 */
export interface McpServerConfig {
  endpoint: string;
  apiKey?: string;
}

export function getMcpServers(): McpServerConfig[] {
  const envServers = process.env.MCP_SERVERS;
  if (envServers) {
    try {
      return JSON.parse(envServers);
    } catch {
      console.error("Failed to parse MCP_SERVERS env var");
      return [];
    }
  }
  return [];
}
