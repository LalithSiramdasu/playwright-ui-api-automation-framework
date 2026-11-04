export interface OnboardingCheck {
  id: string;
  passed: boolean;
  description: string;
}
export interface OnboardingStatus {
  applicable: boolean;
  ready: boolean;
  checks: OnboardingCheck[];
}
export function onboardingStatus(projectDir: string, profile: Record<string, unknown>): OnboardingStatus;
export function assertOnboardingReady(projectDir: string, profile: Record<string, unknown>): OnboardingStatus;
