const AuditLog = require('../models/audit.model');

/**
 * SmartAuditService
 *
 * Unique Features:
 * 1. Auto-diff: Computes field-level before/after changes
 * 2. Risk Scoring: Automatically scores each action for suspicious patterns
 * 3. Human-readable summaries: Auto-generates plain English descriptions
 * 4. Anomaly flags: Detects off-hours activity, large amounts, role escalations
 */
class SmartAuditService {
  /**
   * Log any system action with full context
   */
  static async log({ actor, action, target, before, after, context, status = 'success' }) {
    try {
      const diff = this.computeDiff(before, after);
      const risk = this.assessRisk({ action, diff, actor, context });
      const summary = this.generateSummary({ actor, action, target, diff });
      const tags = this.extractTags({ action, diff, risk });

      await AuditLog.create({
        actor: actor
          ? {
              userId: actor._id,
              name: actor.name,
              email: actor.email,
              role: actor.role,
            }
          : null,
        action,
        target,
        diff,
        summary,
        context,
        risk,
        status,
        tags,
      });
    } catch (err) {
      // Audit logging should never crash the app
      console.error('Audit log error:', err.message);
    }
  }

  /**
   * Computes a field-level diff between two objects.
   * Only stores what actually changed.
   */
  static computeDiff(before, after) {
    if (!before && !after) return {};
    if (!before) return { before: null, after, changedFields: Object.keys(after || {}) };
    if (!after) return { before, after: null, changedFields: [] };

    const changedFields = [];
    const diffBefore = {};
    const diffAfter = {};

    const sensitiveFields = ['password', 'token'];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (sensitiveFields.includes(key)) continue;
      const beforeVal = before[key];
      const afterVal = after[key];

      const serialBefore = JSON.stringify(beforeVal);
      const serialAfter = JSON.stringify(afterVal);

      if (serialBefore !== serialAfter) {
        changedFields.push(key);
        diffBefore[key] = beforeVal;
        diffAfter[key] = afterVal;
      }
    }

    return { before: diffBefore, after: diffAfter, changedFields };
  }

  /**
   * Assesses risk level of an action using multiple signals.
   * Returns a score (0–100) and flags explaining why.
   */
  static assessRisk({ action, diff, actor, context }) {
    let score = 0;
    const flags = [];

    // High-risk actions baseline
    const highRiskActions = ['BULK_DELETE', 'ROLE_CHANGED', 'DATA_EXPORT', 'USER_DELETED'];
    const medRiskActions = ['RECORD_DELETED', 'USER_STATUS_CHANGED', 'RECORD_RESTORED'];

    if (highRiskActions.includes(action)) { score += 40; flags.push('high_risk_action'); }
    if (medRiskActions.includes(action)) { score += 20; flags.push('sensitive_action'); }

    // Large financial amounts
    const amount = diff?.after?.amount || diff?.before?.amount;
    if (amount && amount > 100000) { score += 25; flags.push('large_amount'); }
    else if (amount && amount > 10000) { score += 10; flags.push('significant_amount'); }

    // Role escalation detection
    if (diff?.changedFields?.includes('role')) {
      const fromRole = diff.before?.role;
      const toRole = diff.after?.role;
      const roleRank = { viewer: 1, analyst: 2, admin: 3 };
      if (roleRank[toRole] > roleRank[fromRole]) {
        score += 35;
        flags.push('role_escalation');
      }
    }

    // Off-hours activity (before 7am or after 10pm)
    const hour = new Date().getHours();
    if (hour < 7 || hour > 22) { score += 15; flags.push('off_hours_activity'); }

    // Failed login attempts
    if (action === 'LOGIN_FAILED') { score += 30; flags.push('failed_authentication'); }

    // Cap at 100
    score = Math.min(score, 100);

    const level =
      score >= 70 ? 'critical' :
      score >= 50 ? 'high' :
      score >= 25 ? 'medium' : 'low';

    return { score, level, flags };
  }

  /**
   * Generates a plain English description of what happened.
   */
  static generateSummary({ actor, action, target, diff }) {
    const who = actor?.name || 'System';
    const what = target?.resourceLabel || target?.resourceType || 'a resource';

    const templates = {
      USER_CREATED: () => `${who} created a new user account for "${what}"`,
      USER_UPDATED: () => {
        const fields = diff?.changedFields?.join(', ') || 'some fields';
        return `${who} updated ${fields} for user "${what}"`;
      },
      USER_DELETED: () => `${who} deleted user "${what}"`,
      USER_STATUS_CHANGED: () => {
        const newStatus = diff?.after?.status || 'unknown';
        return `${who} changed status of "${what}" to ${newStatus}`;
      },
      ROLE_CHANGED: () => {
        const from = diff?.before?.role || '?';
        const to = diff?.after?.role || '?';
        return `${who} changed role of "${what}" from ${from} to ${to}`;
      },
      RECORD_CREATED: () => {
        const amount = diff?.after?.amount;
        const type = diff?.after?.type;
        return `${who} created a new ${type || ''} record${amount ? ` of ₹${amount}` : ''} for "${what}"`;
      },
      RECORD_UPDATED: () => {
        const fields = diff?.changedFields?.join(', ') || 'some fields';
        return `${who} updated ${fields} on record "${what}"`;
      },
      RECORD_DELETED: () => `${who} soft-deleted record "${what}"`,
      RECORD_RESTORED: () => `${who} restored previously deleted record "${what}"`,
      LOGIN_SUCCESS: () => `${who} logged in successfully`,
      LOGIN_FAILED: () => `Failed login attempt for account "${what}"`,
      LOGOUT: () => `${who} logged out`,
      BULK_DELETE: () => `${who} performed a bulk delete operation`,
      DATA_EXPORT: () => `${who} exported financial data`,
    };

    return (templates[action] || (() => `${who} performed ${action} on ${what}`))();
  }

  /**
   * Extract searchable tags from action context
   */
  static extractTags({ action, diff, risk }) {
    const tags = [action.toLowerCase().replace(/_/g, '-')];
    if (diff?.changedFields) tags.push(...diff.changedFields.map(f => `field:${f}`));
    if (risk.flags) tags.push(...risk.flags);
    if (risk.level !== 'low') tags.push(`risk:${risk.level}`);
    return tags;
  }

  /**
   * Query audit logs with filters
   */
  static async query({ userId, action, resourceId, riskLevel, startDate, endDate, page = 1, limit = 20 }) {
    const filter = {};

    if (userId) filter['actor.userId'] = userId;
    if (action) filter.action = action;
    if (resourceId) filter['target.resourceId'] = resourceId;
    if (riskLevel) filter['risk.level'] = riskLevel;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get risk summary statistics
   */
  static async getRiskSummary() {
    const [riskBreakdown, recentHighRisk, topActors] = await Promise.all([
      AuditLog.aggregate([
        { $group: { _id: '$risk.level', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AuditLog.find({ 'risk.level': { $in: ['high', 'critical'] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AuditLog.aggregate([
        { $match: { 'risk.score': { $gt: 40 } } },
        { $group: { _id: '$actor.email', count: { $sum: 1 }, avgRisk: { $avg: '$risk.score' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return { riskBreakdown, recentHighRisk, topActors };
  }
}

module.exports = SmartAuditService;
