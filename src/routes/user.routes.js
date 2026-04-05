const express = require('express');
const router = express.Router();
const {
  getAllUsers, getUserById, createUser,
  updateUser, changeRole, changeStatus, deleteUser,
} = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { auditContext } = require('../middleware/auditContext.middleware');

router.use(authenticate, auditContext);

router.get('/', authorize('admin'), getAllUsers);
router.post('/', authorize('admin'), createUser);
router.get('/:id', authorize('admin'), getUserById);
router.patch('/:id', authorize('admin'), updateUser);
router.patch('/:id/role', authorize('admin'), changeRole);
router.patch('/:id/status', authorize('admin'), changeStatus);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
