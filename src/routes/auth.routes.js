const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
} = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { auditContext } = require("../middleware/auditContext.middleware");
const {
  validateRegister,
  validateLogin,
} = require("../middleware/validation.middleware");

router.use(auditContext);

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);

module.exports = router;
