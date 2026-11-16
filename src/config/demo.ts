interface DemoBuildSettings {
  DEV: boolean;
  MODE: string;
  VITE_ENABLE_DEMO_ACCOUNTS?: string;
}

export function demoAccountsEnabled(
  { DEV, MODE, VITE_ENABLE_DEMO_ACCOUNTS: setting }: DemoBuildSettings,
  location?: Pick<Location, 'protocol' | 'hostname'>,
): boolean {
  if (setting !== undefined && setting !== 'true') return false;
  if (MODE === 'vercel')
    return location?.protocol === 'https:' && location.hostname.endsWith('.vercel.app');
  return DEV;
}
