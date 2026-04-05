const { v4: uuidv4 } = require('uuid');

/**
 * Attaches audit context to every request.
 * This data is later used by SmartAuditService to enrich logs.
 */
const auditContext = (req, res, next) => {
  req.auditContext = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: uuidv4(),
    method: req.method,
    endpoint: req.originalUrl,
  };
  next();
};

module.exports = { auditContext };
