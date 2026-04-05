const User = require('../models/user.model');
const AuditService = require('../services/audit.service');
const { AppError } = require('../middleware/error.middleware');

/**
 * GET /api/users  [admin]
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { status, role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { users, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id  [admin]
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users  [admin] - Admin creates users including other admins
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.create({ name, email, password, role });

    await AuditService.log({
      actor: req.user,
      action: 'USER_CREATED',
      target: { resourceType: 'User', resourceId: user._id, resourceLabel: user.email },
      after: { name: user.name, email: user.email, role: user.role },
      context: req.auditContext,
    });

    res.status(201).json({ success: true, message: 'User created', data: { user } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id  [admin]
 */
const updateUser = async (req, res, next) => {
  try {
    const before = await User.findById(req.params.id);
    if (!before) return next(new AppError('User not found', 404));

    const allowedFields = ['name', 'status'];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    await AuditService.log({
      actor: req.user,
      action: 'USER_UPDATED',
      target: { resourceType: 'User', resourceId: updated._id, resourceLabel: updated.email },
      before: before.toJSON(),
      after: updated.toJSON(),
      context: req.auditContext,
    });

    res.json({ success: true, message: 'User updated', data: { user: updated } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id/role  [admin]
 */
const changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) return next(new AppError('Role is required', 400));

    const before = await User.findById(req.params.id);
    if (!before) return next(new AppError('User not found', 404));
    if (before._id.toString() === req.user._id.toString()) {
      return next(new AppError('You cannot change your own role', 400));
    }

    const updated = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });

    await AuditService.log({
      actor: req.user,
      action: 'ROLE_CHANGED',
      target: { resourceType: 'User', resourceId: updated._id, resourceLabel: updated.email },
      before: { role: before.role },
      after: { role: updated.role },
      context: req.auditContext,
    });

    res.json({ success: true, message: `Role updated to ${role}`, data: { user: updated } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id/status  [admin]
 */
const changeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return next(new AppError('Status must be active or inactive', 400));
    }

    const before = await User.findById(req.params.id);
    if (!before) return next(new AppError('User not found', 404));

    const updated = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });

    await AuditService.log({
      actor: req.user,
      action: 'USER_STATUS_CHANGED',
      target: { resourceType: 'User', resourceId: updated._id, resourceLabel: updated.email },
      before: { status: before.status },
      after: { status: updated.status },
      context: req.auditContext,
    });

    res.json({ success: true, message: `User ${status}`, data: { user: updated } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id  [admin]
 */
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return next(new AppError('You cannot delete your own account', 400));
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return next(new AppError('User not found', 404));

    await AuditService.log({
      actor: req.user,
      action: 'USER_DELETED',
      target: { resourceType: 'User', resourceId: user._id, resourceLabel: user.email },
      before: user.toJSON(),
      context: req.auditContext,
    });

    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, changeRole, changeStatus, deleteUser };
