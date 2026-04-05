const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Finance Dashboard API Docs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
    header { background: #1e293b; padding: 24px 40px; border-bottom: 1px solid #334155; }
    header h1 { color: #38bdf8; font-size: 1.8rem; }
    header p { color: #94a3b8; margin-top: 4px; }
    .container { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
    .section { margin-bottom: 40px; }
    .section h2 { color: #38bdf8; font-size: 1.2rem; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 16px; }
    .endpoint { background: #1e293b; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; border-left: 4px solid #334155; }
    .endpoint:hover { border-left-color: #38bdf8; }
    .method { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 10px; }
    .GET    { background: #166534; color: #86efac; }
    .POST   { background: #1e3a5f; color: #93c5fd; }
    .PATCH  { background: #713f12; color: #fde68a; }
    .DELETE { background: #7f1d1d; color: #fca5a5; }
    .path   { font-family: monospace; font-size: 0.95rem; color: #e2e8f0; }
    .desc   { color: #94a3b8; font-size: 0.85rem; margin-top: 6px; }
    .badge  { display: inline-block; font-size: 0.7rem; padding: 1px 8px; border-radius: 999px; margin-left: 8px; }
    .admin    { background: #4c1d95; color: #c4b5fd; }
    .analyst  { background: #0c4a6e; color: #7dd3fc; }
    .viewer   { background: #14532d; color: #86efac; }
    .all      { background: #374151; color: #d1d5db; }
    .unique-banner { background: linear-gradient(135deg, #0f4c75, #1b262c); border: 1px solid #38bdf8; border-radius: 10px; padding: 20px 24px; margin-bottom: 32px; }
    .unique-banner h3 { color: #38bdf8; margin-bottom: 8px; }
    .unique-banner p { color: #94a3b8; font-size: 0.9rem; line-height: 1.6; }
    ul.features { list-style: none; margin-top: 10px; }
    ul.features li::before { content: "✦ "; color: #38bdf8; }
    ul.features li { font-size: 0.88rem; color: #cbd5e1; margin-bottom: 4px; }
  </style>
</head>
<body>
<header>
  <h1>⚡ Finance Dashboard API</h1>
  <p>Node.js · Express · MongoDB · Smart Audit Trail</p>
</header>
<div class="container">

  <div class="unique-banner">
    <h3>🔍 Smart Audit Trail System</h3>
    <p>Every mutation in this system is automatically tracked with:</p>
    <ul class="features">
      <li>Field-level diff (before → after, only changed fields stored)</li>
      <li>Automatic risk scoring (0–100) with anomaly flags</li>
      <li>Plain-English auto-generated summaries per action</li>
      <li>Off-hours detection, role escalation alerts, large-amount flags</li>
      <li>Immutable logs — audit records can never be modified or deleted</li>
    </ul>
  </div>

  <div class="section">
    <h2>🔐 Authentication</h2>
    ${ep('POST','/api/auth/register','Register a new user (viewer/analyst only)','all')}
    ${ep('POST','/api/auth/login','Login and receive JWT token','all')}
    ${ep('POST','/api/auth/logout','Logout (logged in audit trail)','all')}
    ${ep('GET','/api/auth/me','Get current user profile','all')}
  </div>

  <div class="section">
    <h2>👤 User Management</h2>
    ${ep('GET','/api/users','List all users with filters (status, role, page)','admin')}
    ${ep('POST','/api/users','Create any user including admin','admin')}
    ${ep('GET','/api/users/:id','Get user by ID','admin')}
    ${ep('PATCH','/api/users/:id','Update user name or status','admin')}
    ${ep('PATCH','/api/users/:id/role','Change user role (triggers risk score)','admin')}
    ${ep('PATCH','/api/users/:id/status','Activate or deactivate a user','admin')}
    ${ep('DELETE','/api/users/:id','Permanently delete a user','admin')}
  </div>

  <div class="section">
    <h2>💰 Financial Records</h2>
    ${ep('GET','/api/records','List records with filters (type, category, date, amount)','viewer')}
    ${ep('GET','/api/records/:id','Get single record by ID','viewer')}
    ${ep('POST','/api/records','Create a new financial record','analyst')}
    ${ep('PATCH','/api/records/:id','Update a record (field-diff audited)','analyst')}
    ${ep('DELETE','/api/records/:id','Soft-delete a record (restorable)','admin')}
    ${ep('PATCH','/api/records/:id/restore','Restore a soft-deleted record','admin')}
  </div>

  <div class="section">
    <h2>📊 Dashboard & Analytics</h2>
    ${ep('GET','/api/dashboard/summary','Total income, expense, net balance, health status','viewer')}
    ${ep('GET','/api/dashboard/category-breakdown','Category-wise totals by type','viewer')}
    ${ep('GET','/api/dashboard/monthly-trends','Month-by-month income vs expense trends','viewer')}
    ${ep('GET','/api/dashboard/weekly-trends','Week-by-week trends','viewer')}
    ${ep('GET','/api/dashboard/recent-activity','Latest N financial records','viewer')}
    ${ep('GET','/api/dashboard/top-categories','Top spending or earning categories','analyst')}
  </div>

  <div class="section">
    <h2>🔍 Smart Audit Trail</h2>
    ${ep('GET','/api/audit','Query all audit logs with filters','admin')}
    ${ep('GET','/api/audit/:id','Get single audit log with full diff','admin')}
    ${ep('GET','/api/audit/risk-summary','Risk analytics: breakdown, top risky actors','admin')}
    ${ep('GET','/api/audit/actions','List all available action types','admin')}
    ${ep('GET','/api/audit/my-activity','View your own activity trail','all')}
  </div>

  <div class="section">
    <h2>🩺 Health</h2>
    ${ep('GET','/health','Service health check','all')}
  </div>

</div>
</body>
</html>`);
});

function ep(method, path, desc, role) {
  return `<div class="endpoint">
    <span class="method ${method}">${method}</span>
    <span class="path">${path}</span>
    <span class="badge ${role}">${role}</span>
    <div class="desc">${desc}</div>
  </div>`;
}

module.exports = router;
