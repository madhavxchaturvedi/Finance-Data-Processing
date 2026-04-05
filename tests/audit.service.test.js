const SmartAuditService = require("../src/services/audit.service");

describe("SmartAuditService", () => {
  describe("computeDiff", () => {
    it("returns empty diff for identical objects", () => {
      const obj = { amount: 1000, type: "income", category: "salary" };
      const diff = SmartAuditService.computeDiff(obj, { ...obj });
      expect(diff.changedFields).toHaveLength(0);
    });

    it("detects changed fields correctly", () => {
      const before = { amount: 1000, category: "salary", type: "income" };
      const after = { amount: 2000, category: "salary", type: "income" };
      const diff = SmartAuditService.computeDiff(before, after);
      expect(diff.changedFields).toContain("amount");
      expect(diff.changedFields).not.toContain("category");
      expect(diff.before.amount).toBe(1000);
      expect(diff.after.amount).toBe(2000);
    });

    it("never exposes password in diff", () => {
      const before = { email: "a@b.com", password: "secret" };
      const after = { email: "a@b.com", password: "newsecret" };
      const diff = SmartAuditService.computeDiff(before, after);
      expect(diff.changedFields).not.toContain("password");
    });

    it("handles null before (creation)", () => {
      const diff = SmartAuditService.computeDiff(null, { amount: 500 });
      expect(diff.before).toBeNull();
      expect(diff.after.amount).toBe(500);
    });
  });

  describe("assessRisk", () => {
    it("scores BULK_DELETE as high risk", () => {
      const risk = SmartAuditService.assessRisk({
        action: "BULK_DELETE",
        diff: {},
        actor: {},
        context: {},
      });
      expect(risk.score).toBeGreaterThanOrEqual(40);
      expect(["medium", "high", "critical"]).toContain(risk.level);
    });

    it("flags role escalation from viewer to admin", () => {
      const diff = {
        changedFields: ["role"],
        before: { role: "viewer" },
        after: { role: "admin" },
      };
      const risk = SmartAuditService.assessRisk({
        action: "ROLE_CHANGED",
        diff,
        actor: {},
        context: {},
      });
      expect(risk.flags).toContain("role_escalation");
      expect(risk.score).toBeGreaterThanOrEqual(35);
    });

    it("flags large amounts over 100000", () => {
      const diff = { after: { amount: 150000 } };
      const risk = SmartAuditService.assessRisk({
        action: "RECORD_CREATED",
        diff,
        actor: {},
        context: {},
      });
      expect(risk.flags).toContain("large_amount");
    });

    it("assigns low risk to normal login", () => {
      const risk = SmartAuditService.assessRisk({
        action: "LOGIN_SUCCESS",
        diff: {},
        actor: {},
        context: {},
      });
      expect(risk.level).toBe("low");
    });

    it("caps score at 100", () => {
      const diff = {
        changedFields: ["role"],
        before: { role: "viewer" },
        after: { role: "admin", amount: 999999 },
      };
      const risk = SmartAuditService.assessRisk({
        action: "BULK_DELETE",
        diff,
        actor: {},
        context: {},
      });
      expect(risk.score).toBeLessThanOrEqual(100);
    });
  });

  describe("generateSummary", () => {
    it("generates correct summary for RECORD_CREATED", () => {
      const summary = SmartAuditService.generateSummary({
        actor: { name: "Priya" },
        action: "RECORD_CREATED",
        target: { resourceLabel: "expense - food" },
        diff: { after: { amount: 500, type: "expense" } },
      });
      expect(summary).toContain("Priya");
      expect(summary).toContain("expense");
      expect(summary).toContain("₹500");
    });

    it("generates correct summary for ROLE_CHANGED", () => {
      const summary = SmartAuditService.generateSummary({
        actor: { name: "Admin" },
        action: "ROLE_CHANGED",
        target: { resourceLabel: "rahul@test.com" },
        diff: { before: { role: "viewer" }, after: { role: "analyst" } },
      });
      expect(summary).toContain("viewer");
      expect(summary).toContain("analyst");
    });

    it("handles unknown action gracefully", () => {
      const summary = SmartAuditService.generateSummary({
        actor: { name: "Bot" },
        action: "UNKNOWN_ACTION",
        target: { resourceLabel: "something" },
        diff: {},
      });
      expect(summary).toContain("Bot");
      expect(summary).toContain("UNKNOWN_ACTION");
    });
  });

  describe("extractTags", () => {
    it("always includes action tag", () => {
      const tags = SmartAuditService.extractTags({
        action: "RECORD_CREATED",
        diff: { changedFields: [] },
        risk: { flags: [], level: "low" },
      });
      expect(tags).toContain("record-created");
    });

    it("includes risk level tag when not low", () => {
      const tags = SmartAuditService.extractTags({
        action: "ROLE_CHANGED",
        diff: { changedFields: ["role"] },
        risk: { flags: ["role_escalation"], level: "high" },
      });
      expect(tags).toContain("risk:high");
      expect(tags).toContain("role_escalation");
    });
  });
});
