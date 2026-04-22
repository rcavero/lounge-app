const store = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function isLoginBlocked(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now >= entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginAttempts(ip: string): void {
  store.delete(ip);
}
