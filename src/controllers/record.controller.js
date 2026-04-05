const FinancialRecord = require("../models/record.model");
const AuditService = require("../services/audit.service");
const { AppError } = require("../middleware/error.middleware");
const cache = require("../lib/cache");

const invalidateDashboardCache = () => {
  cache.delByPrefix("dashboard:");
};

/**
 * GET /api/records  [viewer, analyst, admin]
 */
const getAllRecords = async (req, res, next) => {
  try {
    const {
      type,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      tags,
      page = 1,
      limit = 20,
      sort = "-date",
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }
    if (tags) filter.tags = { $in: tags.split(",") };

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      FinancialRecord.find(filter)
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      FinancialRecord.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/records/:id  [viewer, analyst, admin]
 */
const getRecordById = async (req, res, next) => {
  try {
    const record = await FinancialRecord.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );
    if (!record) return next(new AppError("Record not found", 404));
    res.json({ success: true, data: { record } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/records  [analyst, admin]
 */
const createRecord = async (req, res, next) => {
  try {
    const { amount, type, category, date, description, tags } = req.body;

    const record = await FinancialRecord.create({
      amount,
      type,
      category,
      date: date || new Date(),
      description,
      tags,
      createdBy: req.user._id,
    });

    await AuditService.log({
      actor: req.user,
      action: "RECORD_CREATED",
      target: {
        resourceType: "FinancialRecord",
        resourceId: record._id,
        resourceLabel: `${type} - ${category}`,
      },
      after: { amount, type, category, date: record.date },
      context: req.auditContext,
    });

    invalidateDashboardCache();

    res
      .status(201)
      .json({ success: true, message: "Record created", data: { record } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/records/:id  [analyst, admin]
 */
const updateRecord = async (req, res, next) => {
  try {
    const before = await FinancialRecord.findById(req.params.id);
    if (!before) return next(new AppError("Record not found", 404));

    const allowedFields = [
      "amount",
      "type",
      "category",
      "date",
      "description",
      "tags",
    ];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const updated = await FinancialRecord.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    );

    await AuditService.log({
      actor: req.user,
      action: "RECORD_UPDATED",
      target: {
        resourceType: "FinancialRecord",
        resourceId: updated._id,
        resourceLabel: `${updated.type} - ${updated.category}`,
      },
      before: before.toObject(),
      after: updated.toObject(),
      context: req.auditContext,
    });

    invalidateDashboardCache();

    res.json({
      success: true,
      message: "Record updated",
      data: { record: updated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/records/:id  [admin] - Soft delete
 */
const deleteRecord = async (req, res, next) => {
  try {
    const record = await FinancialRecord.findById(req.params.id);
    if (!record) return next(new AppError("Record not found", 404));

    record.isDeleted = true;
    record.deletedAt = new Date();
    record.deletedBy = req.user._id;
    await record.save();

    await AuditService.log({
      actor: req.user,
      action: "RECORD_DELETED",
      target: {
        resourceType: "FinancialRecord",
        resourceId: record._id,
        resourceLabel: `${record.type} - ${record.category} - ₹${record.amount}`,
      },
      before: {
        amount: record.amount,
        type: record.type,
        category: record.category,
      },
      context: req.auditContext,
    });

    invalidateDashboardCache();

    res.json({
      success: true,
      message: "Record soft-deleted (can be restored)",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/records/:id/restore  [admin]
 */
const restoreRecord = async (req, res, next) => {
  try {
    const record = await FinancialRecord.findOne({
      _id: req.params.id,
      isDeleted: true,
      includeDeleted: true,
    });
    if (!record) return next(new AppError("Deleted record not found", 404));

    record.isDeleted = false;
    record.deletedAt = undefined;
    record.deletedBy = undefined;
    await record.save();

    await AuditService.log({
      actor: req.user,
      action: "RECORD_RESTORED",
      target: {
        resourceType: "FinancialRecord",
        resourceId: record._id,
        resourceLabel: `${record.type} - ${record.category}`,
      },
      after: { amount: record.amount, type: record.type },
      context: req.auditContext,
    });

    invalidateDashboardCache();

    res.json({
      success: true,
      message: "Record restored successfully",
      data: { record },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  restoreRecord,
};
