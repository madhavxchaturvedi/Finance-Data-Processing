const AuditService = require('../services/audit.service');
const AuditLog = require('../models/audit.model');
const { AppError } = require('../middleware/error.middleware');

/**
 * GET /api/audit  [admin]
 * Query audit logs with filters
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { userId, action, resourceId, riskLevel, startDate, endDate, page, limit } = req.query;

    const result = await AuditService.query({
      userId, action, resourceId, riskLevel,
      startDate, endDate,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit/:id  [admin]
 */
const getAuditLogById = async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) return next(new AppError('Audit log not found', 404));
    res.json({ success: true, data: { log } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit/risk-summary  [admin]
 * Risk analytics dashboard
 */
const getRiskSummary = async (req, res, next) => {
  try {
    const summary = await AuditService.getRiskSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit/my-activity  [all roles]
 * Users can view their own audit trail
 */
const getMyActivity = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await AuditService.query({
      userId: req.user._id,
      page: Number(page),
      limit: Number(limit),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit/actions  [admin]
 * Available action types for filtering
 */
const getAvailableActions = (req, res) => {
  const actions = [
    'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_STATUS_CHANGED',
    'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED', 'RECORD_RESTORED',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
    'ROLE_CHANGED', 'BULK_DELETE', 'DATA_EXPORT',
  ];
  res.json({ success: true, data: { actions } });
};

module.exports = { getAuditLogs, getAuditLogById, getRiskSummary, getMyActivity, getAvailableActions };
