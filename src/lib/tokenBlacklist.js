const jwt = require("jsonwebtoken");

// In-memory token blacklist with expiry-aware cleanup.
const blacklist = new Map();

const decodeExpiryMs = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object" || !decoded.exp) {
    return Date.now() + 24 * 60 * 60 * 1000;
  }
  return decoded.exp * 1000;
};

const add = (token) => {
  if (!token) return;
  blacklist.set(token, decodeExpiryMs(token));
};

const has = (token) => {
  if (!token) return false;
  const expiryMs = blacklist.get(token);
  if (!expiryMs) return false;
  if (Date.now() >= expiryMs) {
    blacklist.delete(token);
    return false;
  }
  return true;
};

const pruneExpired = () => {
  const now = Date.now();
  for (const [token, expiryMs] of blacklist.entries()) {
    if (now >= expiryMs) blacklist.delete(token);
  }
};

const clear = () => {
  blacklist.clear();
};

module.exports = { add, has, pruneExpired, clear };
