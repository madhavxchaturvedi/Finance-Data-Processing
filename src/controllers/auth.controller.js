const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const AuditService = require("../services/audit.service");
const { AppError } = require("../middleware/error.middleware");
const tokenBlacklist = require("../lib/tokenBlacklist");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

const signToken = (id) => {
  if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
    throw new AppError("JWT secret is not configured", 500);
  }
  return jwt.sign({ id }, JWT_SECRET || "finance_jwt_secret_dev_only", {
    expiresIn: JWT_EXPIRES,
  });
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Only admins can create admin accounts
    if (role === "admin") {
      return next(
        new AppError(
          "Cannot self-register as admin. Contact an administrator.",
          403,
        ),
      );
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "viewer",
    });
    const token = signToken(user._id);

    await AuditService.log({
      actor: user,
      action: "USER_CREATED",
      target: {
        resourceType: "User",
        resourceId: user._id,
        resourceLabel: user.email,
      },
      after: { name: user.name, email: user.email, role: user.role },
      context: req.auditContext,
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Registration successful",
        data: { token, user },
      });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError("Email and password are required", 400));
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      await AuditService.log({
        actor: null,
        action: "LOGIN_FAILED",
        target: { resourceType: "User", resourceLabel: email },
        context: req.auditContext,
        status: "failed",
      });
      return next(new AppError("Invalid email or password", 401));
    }

    if (user.status === "inactive") {
      return next(
        new AppError("Your account has been deactivated. Contact admin.", 403),
      );
    }

    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    await AuditService.log({
      actor: user,
      action: "LOGIN_SUCCESS",
      target: {
        resourceType: "User",
        resourceId: user._id,
        resourceLabel: user.email,
      },
      context: req.auditContext,
    });

    res.json({
      success: true,
      message: "Login successful",
      data: { token, user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;
    if (token) {
      tokenBlacklist.add(token);
    }

    await AuditService.log({
      actor: req.user,
      action: "LOGOUT",
      target: {
        resourceType: "User",
        resourceId: req.user._id,
        resourceLabel: req.user.email,
      },
      context: req.auditContext,
    });
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe };
