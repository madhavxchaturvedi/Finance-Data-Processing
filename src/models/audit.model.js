const mongoose = require('mongoose');

/**
 * Smart Audit Trail Model
 *
 * Every mutation in the system is captured here with:
 * - Full before/after diff (only changed fields stored)
 * - Contextual metadata (IP, user agent, request ID)
 * - Risk scoring for suspicious activity detection
 * - Human-readable change summary auto-generated
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      email: String,
      role: String,
    },

    // What happened
    action: {
      type: String,
      required: true,
      enum: [
        'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_STATUS_CHANGED',
        'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED', 'RECORD_RESTORED',
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
        'ROLE_CHANGED', 'BULK_DELETE', 'DATA_EXPORT',
      ],
    },

    // What was affected
    target: {
      resourceType: { type: String, enum: ['User', 'FinancialRecord', 'System'] },
      resourceId: mongoose.Schema.Types.ObjectId,
      resourceLabel: String, // human-readable identifier
    },

    // The actual change diff (before → after)
    diff: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
      changedFields: [String],
    },

    // Auto-generated plain English summary
    summary: { type: String },

    // Request context
    context: {
      ip: String,
      userAgent: String,
      requestId: String,
      method: String,
      endpoint: String,
    },

    // Risk assessment
    risk: {
      score: { type: Number, default: 0, min: 0, max: 100 },
      level: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
      flags: [String], // e.g. ['large_amount', 'role_escalation', 'off_hours']
    },

    // Outcome
    status: {
      type: String,
      enum: ['success', 'failed', 'blocked'],
      default: 'success',
    },

    // Searchable tags
    tags: [String],
  },
  {
    timestamps: true,
    // Audit logs are immutable — no updates allowed
  }
);

// Indexes for fast querying
auditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'target.resourceId': 1 });
auditLogSchema.index({ 'risk.level': 1 });
auditLogSchema.index({ createdAt: -1 });

// Prevent updates to audit logs (immutability)
auditLogSchema.pre(['updateOne', 'findOneAndUpdate'], function () {
  throw new Error('Audit logs are immutable and cannot be modified.');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
