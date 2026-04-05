const express = require('express');
const router = express.Router();
const {
  getAuditLogs,
  getAuditLogById,
  getRiskSummary,
  getMyActivity,
  getAvailableActions,
} = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// All users can view their own activity
router.get('/my-activity', getMyActivity);

// Admin-only audit routes
router.get('/', authorize('admin'), getAuditLogs);
router.get('/risk-summary', authorize('admin'), getRiskSummary);
router.get('/actions', authorize('admin'), getAvailableActions);
router.get('/:id', authorize('admin'), getAuditLogById);

module.exports = router;
