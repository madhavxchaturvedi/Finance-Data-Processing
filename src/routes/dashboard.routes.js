const express = require('express');
const router = express.Router();
const {
  getSummary, getCategoryBreakdown, getMonthlyTrends,
  getWeeklyTrends, getRecentActivity, getTopCategories,
} = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// All roles can view dashboard
router.get('/summary', authorize('viewer', 'analyst', 'admin'), getSummary);
router.get('/category-breakdown', authorize('viewer', 'analyst', 'admin'), getCategoryBreakdown);
router.get('/monthly-trends', authorize('viewer', 'analyst', 'admin'), getMonthlyTrends);
router.get('/weekly-trends', authorize('viewer', 'analyst', 'admin'), getWeeklyTrends);
router.get('/recent-activity', authorize('viewer', 'analyst', 'admin'), getRecentActivity);
router.get('/top-categories', authorize('analyst', 'admin'), getTopCategories);

module.exports = router;
