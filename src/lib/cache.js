const cacheStore = new Map();

const now = () => Date.now();

const buildKey = (prefix, query = {}) => {
  const normalized = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");
  return normalized ? `${prefix}?${normalized}` : prefix;
};

const get = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (now() >= entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
};

const set = (key, value, ttlSeconds = 120) => {
  cacheStore.set(key, {
    value,
    expiresAt: now() + ttlSeconds * 1000,
  });
};

const delByPrefix = (prefix) => {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
};

const clear = () => {
  cacheStore.clear();
};

module.exports = { buildKey, get, set, delByPrefix, clear };
