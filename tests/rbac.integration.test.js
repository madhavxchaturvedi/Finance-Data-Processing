const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/models/user.model", () => ({
  findById: jest.fn(),
}));

jest.mock("../src/models/record.model", () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../src/services/audit.service", () => ({
  log: jest.fn().mockResolvedValue(true),
}));

const User = require("../src/models/user.model");
const FinancialRecord = require("../src/models/record.model");
const cache = require("../src/lib/cache");
const tokenBlacklist = require("../src/lib/tokenBlacklist");

const withSelect = (value) => {
  const promise = Promise.resolve(value);
  promise.select = jest.fn().mockResolvedValue(value);
  return promise;
};

const users = {
  viewer: {
    _id: "viewer-id",
    name: "Viewer",
    email: "viewer@test.com",
    role: "viewer",
    status: "active",
  },
  analyst: {
    _id: "analyst-id",
    name: "Analyst",
    email: "analyst@test.com",
    role: "analyst",
    status: "active",
  },
  admin: {
    _id: "admin-id",
    name: "Admin",
    email: "admin@test.com",
    role: "admin",
    status: "active",
  },
};

describe("RBAC integration flow", () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = "test_jwt_secret";
    process.env.NODE_ENV = "test";
    app = require("../src/app");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cache.clear();
    tokenBlacklist.clear();

    User.findById.mockImplementation((id) => {
      const value = Object.values(users).find((u) => u._id === id) || null;
      return withSelect(value);
    });

    FinancialRecord.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });
    FinancialRecord.countDocuments.mockResolvedValue(0);
  });

  const tokenFor = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  it("viewer cannot create records", async () => {
    const res = await request(app)
      .post("/api/records")
      .set("Authorization", `Bearer ${tokenFor(users.viewer._id)}`)
      .send({ amount: 1200, type: "income", category: "salary" });

    expect(res.status).toBe(403);
  });

  it("analyst can create records", async () => {
    FinancialRecord.create.mockResolvedValue({
      _id: "r1",
      amount: 1200,
      type: "income",
      category: "salary",
      date: new Date(),
      createdBy: users.analyst._id,
    });

    const res = await request(app)
      .post("/api/records")
      .set("Authorization", `Bearer ${tokenFor(users.analyst._id)}`)
      .send({ amount: 1200, type: "income", category: "salary" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("analyst cannot delete records", async () => {
    const res = await request(app)
      .delete("/api/records/r1")
      .set("Authorization", `Bearer ${tokenFor(users.analyst._id)}`);

    expect(res.status).toBe(403);
  });

  it("admin can soft-delete records", async () => {
    const record = {
      _id: "r2",
      amount: 500,
      type: "expense",
      category: "food",
      isDeleted: false,
      save: jest.fn().mockResolvedValue(true),
    };
    FinancialRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .delete("/api/records/r2")
      .set("Authorization", `Bearer ${tokenFor(users.admin._id)}`);

    expect(res.status).toBe(200);
    expect(record.isDeleted).toBe(true);
    expect(record.save).toHaveBeenCalled();
  });

  it("admin can restore soft-deleted records", async () => {
    const deletedRecord = {
      _id: "r3",
      amount: 300,
      type: "expense",
      category: "transport",
      isDeleted: true,
      save: jest.fn().mockResolvedValue(true),
    };
    FinancialRecord.findOne.mockResolvedValue(deletedRecord);

    const res = await request(app)
      .patch("/api/records/r3/restore")
      .set("Authorization", `Bearer ${tokenFor(users.admin._id)}`);

    expect(res.status).toBe(200);
    expect(deletedRecord.isDeleted).toBe(false);
    expect(deletedRecord.save).toHaveBeenCalled();
  });
});
