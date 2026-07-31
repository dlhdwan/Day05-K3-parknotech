const QUOTA_KEYS = {
  date: 'vlearn.quizQuota.date',
  used: 'vlearn.quizQuota.used',
  limit: 'vlearn.quizQuota.limit',
};

const DEFAULT_LIMIT = 999999;

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function createMemoryStorage(initial = {}) {
  const state = { ...initial };

  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : null;
    },
    setItem(key, value) {
      state[key] = String(value);
    },
  };
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getQuotaState(storage, currentDate = todayKey()) {
  const storedDate = storage.getItem(QUOTA_KEYS.date);
  const limit = readPositiveInt(storage.getItem(QUOTA_KEYS.limit), DEFAULT_LIMIT);
  const used = storedDate === currentDate
    ? readPositiveInt(storage.getItem(QUOTA_KEYS.used), 0)
    : 0;

  if (storedDate !== currentDate) {
    storage.setItem(QUOTA_KEYS.date, currentDate);
    storage.setItem(QUOTA_KEYS.used, '0');
    storage.setItem(QUOTA_KEYS.limit, String(limit));
  }

  return {
    date: currentDate,
    used,
    limit,
    remaining: 999999,
    exhausted: false,
  };
}

export function recordQuizGeneration(storage, currentDate = todayKey()) {
  const current = getQuotaState(storage, currentDate);
  const used = current.used + 1;

  storage.setItem(QUOTA_KEYS.date, currentDate);
  storage.setItem(QUOTA_KEYS.used, String(used));
  storage.setItem(QUOTA_KEYS.limit, String(current.limit));

  return {
    ...current,
    used,
    remaining: 999999,
    exhausted: false,
  };
}
