const { AppError } = require("./error.middleware");

const allowedRecordTypes = ["income", "expense"];
const allowedCategories = [
  "salary",
  "freelance",
  "investment",
  "rental",
  "food",
  "transport",
  "utilities",
  "healthcare",
  "entertainment",
  "shopping",
  "education",
  "other",
];

const isValidDate = (value) => value && !Number.isNaN(Date.parse(value));

const sanitizeText = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().replace(/\s+/g, " ");
};

const validateRegister = (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return next(new AppError("Name, email and password are required", 400));
  if (typeof name !== "string" || sanitizeText(name).length < 2)
    return next(new AppError("Name must be at least 2 characters", 422));
  if (typeof email !== "string" || !email.includes("@"))
    return next(new AppError("Valid email is required", 422));
  if (typeof password !== "string" || password.length < 6)
    return next(new AppError("Password must be at least 6 characters", 422));
  if (role && !["viewer", "analyst", "admin"].includes(role))
    return next(new AppError("Role must be viewer, analyst or admin", 422));

  req.body.name = sanitizeText(name);
  req.body.email = email.trim().toLowerCase();
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError("Email and password are required", 400));
  if (typeof email !== "string" || !email.includes("@"))
    return next(new AppError("Valid email is required", 422));
  if (typeof password !== "string" || password.length < 6)
    return next(new AppError("Password must be at least 6 characters", 422));

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateRecordPayload = (req, res, next) => {
  const { amount, type, category, description, tags } = req.body;

  if (req.method === "POST") {
    if (amount === undefined || !type || !category) {
      return next(new AppError("Amount, type and category are required", 400));
    }
  }

  if (
    amount !== undefined &&
    (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
  ) {
    return next(new AppError("Amount must be a number greater than 0", 422));
  }
  if (type !== undefined && !allowedRecordTypes.includes(type)) {
    return next(new AppError("Type must be income or expense", 422));
  }
  if (category !== undefined && !allowedCategories.includes(category)) {
    return next(new AppError("Category is invalid", 422));
  }
  if (description !== undefined && typeof description === "string") {
    req.body.description = sanitizeText(description);
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags))
      return next(new AppError("Tags must be an array of strings", 422));
    req.body.tags = tags
      .filter((t) => typeof t === "string")
      .map((t) => sanitizeText(t))
      .filter(Boolean);
  }
  next();
};

const validateRecordQuery = (req, res, next) => {
  const { startDate, endDate, page, limit, minAmount, maxAmount, type } =
    req.query;

  if (startDate && !isValidDate(startDate))
    return next(new AppError("startDate must be a valid date", 422));
  if (endDate && !isValidDate(endDate))
    return next(new AppError("endDate must be a valid date", 422));
  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1))
    return next(new AppError("page must be an integer >= 1", 422));
  if (
    limit &&
    (!Number.isInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 100)
  ) {
    return next(
      new AppError("limit must be an integer between 1 and 100", 422),
    );
  }
  if (
    minAmount &&
    (!Number.isFinite(Number(minAmount)) || Number(minAmount) < 0)
  ) {
    return next(new AppError("minAmount must be a positive number", 422));
  }
  if (
    maxAmount &&
    (!Number.isFinite(Number(maxAmount)) || Number(maxAmount) < 0)
  ) {
    return next(new AppError("maxAmount must be a positive number", 422));
  }
  if (type && !allowedRecordTypes.includes(type))
    return next(new AppError("type must be income or expense", 422));

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateRecordPayload,
  validateRecordQuery,
};
