type AttemptState = {
  count: number;
  blockedUntil: number;
  lastAttemptAt: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BASE_BLOCK_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const attempts = new Map<string, AttemptState>();
let lastCleanupAt = 0;

function now() {
  return Date.now();
}

function cleanupExpiredEntries() {
  const current = now();
  if (current - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = current;

  for (const [key, state] of attempts.entries()) {
    const inactiveFor = current - state.lastAttemptAt;
    if (inactiveFor > WINDOW_MS && state.blockedUntil <= current) {
      attempts.delete(key);
    }
  }
}

function normalizeIdentifier(raw: string) {
  return raw.trim().toLowerCase();
}

export function registerLoginFailure(identifier: string): { blockedUntil: number } {
  cleanupExpiredEntries();
  const key = normalizeIdentifier(identifier);
  const current = now();
  const previous = attempts.get(key);

  const outsideWindow = !previous || current - previous.lastAttemptAt > WINDOW_MS;
  const nextCount = outsideWindow ? 1 : previous.count + 1;

  let blockedUntil = previous?.blockedUntil ?? 0;
  if (nextCount >= MAX_ATTEMPTS) {
    const multiplier = Math.max(1, nextCount - MAX_ATTEMPTS + 1);
    blockedUntil = current + BASE_BLOCK_MS * multiplier;
  }

  attempts.set(key, {
    count: nextCount,
    blockedUntil,
    lastAttemptAt: current,
  });

  return { blockedUntil };
}

export function clearLoginFailures(identifier: string) {
  cleanupExpiredEntries();
  attempts.delete(normalizeIdentifier(identifier));
}

export function getLoginBlockStatus(identifier: string): { blocked: boolean; retryAfterSeconds: number } {
  cleanupExpiredEntries();
  const key = normalizeIdentifier(identifier);
  const state = attempts.get(key);
  if (!state) return { blocked: false, retryAfterSeconds: 0 };

  const current = now();
  if (state.blockedUntil <= current) return { blocked: false, retryAfterSeconds: 0 };

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((state.blockedUntil - current) / 1000)),
  };
}
