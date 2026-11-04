export interface TargetPolicyResult { remote: boolean; restricted: boolean; host: string | null }
export function assessTargetPolicy(
  profile: { environments: Record<string, { webBaseUrl?: string; apiBaseUrl?: string; readOnly: boolean }>; remoteExecution?: { enabled: boolean } },
  environment: string,
  options?: { remoteOptIn?: boolean; approval?: string },
): TargetPolicyResult;
