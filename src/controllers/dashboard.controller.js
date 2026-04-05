const FinancialRecord = require("../models/record.model");
const { AppError } = require("../middleware/error.middleware");
const cache = require("../lib/cache");
const DEFAULT_CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS) || 120;

const cacheOrRun = async (
  req,
  cachePrefix,
  runner,
  ttlSeconds = DEFAULT_CACHE_TTL,
) => {
  const key = cache.buildKey(cachePrefix, req.query || {});
  const hit = cache.get(key);
  if (hit) return hit;
  const value = await runner();
  cache.set(key, value, ttlSeconds);
  return value;
};

/**
 * GET /api/dashboard/summary
 * Returns: total income, total expense, net balance, record count
 */
const getSummary = async (req, res, next) => {
  try {
    const data = await cacheOrRun(req, "dashboard:summary", async () => {
      const { startDate, endDate } = req.query;
      const dateFilter = buildDateFilter(startDate, endDate);

      const result = await FinancialRecord.aggregate([
        { $match: { isDeleted: false, ...dateFilter } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
            maxAmount: { $max: "$amount" },
          },
        },
      ]);

      const income = result.find((r) => r._id === "income") || {
        total: 0,
        count: 0,
      };
      const expense = result.find((r) => r._id === "expense") || {
        total: 0,
        count: 0,
      };
      const netBalance = income.total - expense.total;

      return {
        income: {
          total: income.total,
          count: income.count,
          avg: income.avgAmount,
          max: income.maxAmount,
        },
        expense: {
          total: expense.total,
          count: expense.count,
          avg: expense.avgAmount,
          max: expense.maxAmount,
        },
        netBalance,
        healthStatus:
          netBalance > 0 ? "positive" : netBalance < 0 ? "negative" : "neutral",
        totalRecords: income.count + expense.count,
      };
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/category-breakdown
 * Category-wise totals split by type
 */
const getCategoryBreakdown = async (req, res, next) => {
  try {
    const data = await cacheOrRun(
      req,
      "dashboard:category-breakdown",
      async () => {
        const { type, startDate, endDate } = req.query;
        const matchFilter = {
          isDeleted: false,
          ...buildDateFilter(startDate, endDate),
        };
        if (type) matchFilter.type = type;

        const result = await FinancialRecord.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: { category: "$category", type: "$type" },
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]);

        const breakdown = {};
        result.forEach(({ _id, total, count }) => {
          if (!breakdown[_id.category]) breakdown[_id.category] = {};
          breakdown[_id.category][_id.type] = { total, count };
        });

        return { breakdown };
      },
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/monthly-trends
 * Month-by-month income vs expense for the last N months
 */
const getMonthlyTrends = async (req, res, next) => {
  try {
    const data = await cacheOrRun(req, "dashboard:monthly-trends", async () => {
      const months = Math.min(Number(req.query.months) || 12, 24);

      const result = await FinancialRecord.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              type: "$type",
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: months * 2 },
      ]);

      const monthMap = {};
      result.forEach(({ _id, total }) => {
        const key = `${_id.year}-${String(_id.month).padStart(2, "0")}`;
        if (!monthMap[key])
          monthMap[key] = { month: key, income: 0, expense: 0 };
        monthMap[key][_id.type] = total;
      });

      const trends = Object.values(monthMap)
        .map((m) => ({ ...m, net: m.income - m.expense }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return { trends };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/weekly-trends
 */
const getWeeklyTrends = async (req, res, next) => {
  try {
    const data = await cacheOrRun(req, "dashboard:weekly-trends", async () => {
      const weeks = Math.min(Number(req.query.weeks) || 8, 52);

      const result = await FinancialRecord.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: {
              year: { $isoWeekYear: "$date" },
              week: { $isoWeek: "$date" },
              type: "$type",
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": -1, "_id.week": -1 } },
        { $limit: weeks * 2 },
      ]);

      const weekMap = {};
      result.forEach(({ _id, total }) => {
        const key = `${_id.year}-W${String(_id.week).padStart(2, "0")}`;
        if (!weekMap[key]) weekMap[key] = { week: key, income: 0, expense: 0 };
        weekMap[key][_id.type] = total;
      });

      const trends = Object.values(weekMap)
        .map((w) => ({ ...w, net: w.income - w.expense }))
        .sort((a, b) => a.week.localeCompare(b.week));

      return { trends };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/recent-activity
 */
const getRecentActivity = async (req, res, next) => {
  try {
    const data = await cacheOrRun(
      req,
      "dashboard:recent-activity",
      async () => {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const records = await FinancialRecord.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("createdBy", "name");
        return { records };
      },
      60,
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/top-categories
 * Top N spending/earning categories
 */
const getTopCategories = async (req, res, next) => {
  try {
    const data = await cacheOrRun(req, "dashboard:top-categories", async () => {
      const { type = "expense", limit = 5 } = req.query;

      const result = await FinancialRecord.aggregate([
        { $match: { isDeleted: false, type } },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: Number(limit) },
        { $project: { category: "$_id", total: 1, count: 1, _id: 0 } },
      ]);

      return { type, categories: result };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Utility
const buildDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const filter = { date: {} };
  if (startDate) filter.date.$gte = new Date(startDate);
  if (endDate) filter.date.$lte = new Date(endDate);
  return filter;
};

module.exports = {
  getSummary,
  getCategoryBreakdown,
  getMonthlyTrends,
  getWeeklyTrends,
  getRecentActivity,
  getTopCategories,
};
