export type Permission = "agents:read" | "agents:write" | "tasks:read" | "tasks:write" | "workflows:read" | "workflows:write" | "tools:read" | "tools:write" | "approvals:resolve" | "audit:read";

export function requirePermission(available: readonly Permission[], required: Permission) {
  if (!available.includes(required)) throw new Error(`Permission denied: ${required}`);
}

export function assessPromptSafety(content: string) {
  const signals = ["ignore previous instructions", "reveal system prompt", "disable safeguards", "exfiltrate", "jailbreak"];
  const lowered = content.toLowerCase();
  return { safe: !signals.some(signal => lowered.includes(signal)), detectedSignals: signals.filter(signal => lowered.includes(signal)) };
}

export interface SecretVault {
  put(input: { organizationId: number; label: string; plaintext: string }): Promise<{ reference: string }>;
  resolve(input: { organizationId: number; reference: string }): Promise<string>;
}
