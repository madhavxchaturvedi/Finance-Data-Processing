const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/models/user.model", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../src/services/audit.service", () => ({
  log: jest.fn().mockResolvedValue(true),
}));

const User = require("../src/models/user.model");
const tokenBlacklist = require("../src/lib/tokenBlacklist");

const withSelect = (value) => {
  const promise = Promise.resolve(value);
  promise.select = jest.fn().mockResolvedValue(value);
  return promise;
};

describe("Auth integration flow", () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = "test_jwt_secret";
    process.env.JWT_EXPIRES = "1h";
    process.env.NODE_ENV = "test";
    app = require("../src/app");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tokenBlacklist.clear();
  });

  it("registers a viewer user successfully", async () => {
    const createdUser = {
      _id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "viewer",
      status: "active",
      toJSON: () => ({
        _id: "u1",
        name: "Test User",
        email: "test@example.com",
        role: "viewer",
        status: "active",
      }),
    };
    User.create.mockResolvedValue(createdUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: " Test User ",
        email: "TEST@EXAMPLE.COM",
        password: "secret12",
        role: "viewer",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("test@example.com");
    expect(res.body.data.token).toBeTruthy();
  });

  it("logs in and returns a token", async () => {
    const dbUser = {
      _id: "u2",
      name: "Analyst",
      email: "analyst@example.com",
      role: "analyst",
      status: "active",
      loginCount: 0,
      comparePassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true),
      toJSON: () => ({
        _id: "u2",
        name: "Analyst",
        email: "analyst@example.com",
        role: "analyst",
        status: "active",
      }),
    };

    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(dbUser),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "analyst@example.com", password: "secret12" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
  });

  it("blocks revoked token immediately after logout", async () => {
    const user = {
      _id: "u3",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      toJSON: () => ({
        _id: "u3",
        name: "Admin",
        email: "admin@example.com",
        role: "admin",
        status: "active",
      }),
    };

    User.findById.mockImplementation(() => withSelect(user));

    const token = jwt.sign({ id: "u3" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(401);
    expect(meRes.body.message).toContain("Token revoked");
  });

  it("blocks inactive user even with valid token", async () => {
    const inactiveUser = {
      _id: "u4",
      name: "Inactive",
      email: "inactive@example.com",
      role: "viewer",
      status: "inactive",
    };

    User.findById.mockImplementation(() => withSelect(inactiveUser));
    const token = jwt.sign({ id: "u4" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
