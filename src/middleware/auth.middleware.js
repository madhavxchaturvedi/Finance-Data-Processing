const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const tokenBlacklist = require("../lib/tokenBlacklist");

const JWT_SECRET = process.env.JWT_SECRET;

const assertJwtSecret = () => {
  if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
    throw new Error("JWT_SECRET is required in non-development environments.");
  }
};

/**
 * Verify JWT and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    assertJwtSecret();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    if (tokenBlacklist.has(token)) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Token revoked. Please login again.",
        });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET || "finance_jwt_secret_dev_only",
    );

    const user = await User.findById(decoded.id).select("+role +status");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Token invalid. User not found." });
    }
    if (user.status === "inactive") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Your account has been deactivated.",
        });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({
          success: false,
          message: "Token expired. Please login again.",
        });
    }
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
};

/**
 * Role-based access control factory
 * Usage: authorize('admin') or authorize('admin', 'analyst')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(", ")}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
