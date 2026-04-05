const express = require("express");
const router = express.Router();
const {
  getAllRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  restoreRecord,
} = require("../controllers/record.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { auditContext } = require("../middleware/auditContext.middleware");
const {
  validateRecordPayload,
  validateRecordQuery,
} = require("../middleware/validation.middleware");

router.use(authenticate, auditContext);

// All authenticated users can read
router.get(
  "/",
  authorize("viewer", "analyst", "admin"),
  validateRecordQuery,
  getAllRecords,
);
router.get("/:id", authorize("viewer", "analyst", "admin"), getRecordById);

// Analysts and admins can write
router.post(
  "/",
  authorize("analyst", "admin"),
  validateRecordPayload,
  createRecord,
);
router.patch(
  "/:id",
  authorize("analyst", "admin"),
  validateRecordPayload,
  updateRecord,
);

// Only admins can delete/restore
router.delete("/:id", authorize("admin"), deleteRecord);
router.patch("/:id/restore", authorize("admin"), restoreRecord);

module.exports = router;
