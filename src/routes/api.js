const express = require('express');
const router = express.Router();
const cirController = require('../controllers/cirController');
const authController = require('../controllers/authController');
const {
  authenticate,
  enforceTenantScope,
  adminAuth,
  rateLimitExport,
} = require('../middleware/auth');

// ==========================================
// 1. Public Endpoints (Zero Sensitive Data)
// ==========================================
router.get('/health', cirController.checkHealth);
router.post('/auth/login', authController.login);
router.get('/movement-history', authenticate, cirController.getMovementHistory);

// ==========================================
// 2. Authenticated Endpoints (req.user required)
// ==========================================
router.get('/auth/me', authenticate, authController.getMe);

// Core business endpoints protected by server-side authentication and tenant isolation
router.get('/cir-report', authenticate, enforceTenantScope, cirController.getCIRReport);
router.get('/financial-analytics', authenticate, enforceTenantScope, cirController.getFinancialAnalytics);
router.get('/containers', authenticate, enforceTenantScope, cirController.getContainers);
router.get('/masters', authenticate, enforceTenantScope, cirController.getMasters);
router.get('/fleet', authenticate, enforceTenantScope, cirController.getFleet);
router.get('/operations', authenticate, enforceTenantScope, cirController.getOperations);

// Live Vessel Engine & API Key Management Endpoints
router.get('/vessel/schedules', authenticate, enforceTenantScope, cirController.getVesselSchedules);
router.get('/vessel/config', authenticate, enforceTenantScope, cirController.getVesselConfig);
router.post('/vessel/config', authenticate, enforceTenantScope, cirController.saveVesselConfig);

// Excel export with authentication, tenant isolation, and rate limiting
router.get('/export/excel', authenticate, enforceTenantScope, rateLimitExport, cirController.exportExcel);

// User & Role Access Management Endpoints
router.get('/auth/users', authenticate, authController.getUsers);
router.post('/auth/users', authenticate, authController.createUser);
router.delete('/auth/users/:id', authenticate, authController.deleteUser);

// ==========================================
// 3. Administrative Endpoints
// ==========================================
router.post('/sync-warehouse', adminAuth, cirController.syncWarehouse);
router.get('/warehouse-status', adminAuth, cirController.getWarehouseStatus);
router.get('/cache-stats', adminAuth, (req, res) => {
  const cacheService = require('../services/cacheService');
  res.json({ success: true, data: cacheService.stats() });
});
router.post('/cache-flush', adminAuth, (req, res) => {
  const cacheService = require('../services/cacheService');
  cacheService.clear();
  res.json({ success: true, message: 'All in-memory cache flushed successfully' });
});

// ==========================================
// 4. Panvaya Maritime Intelligence & Tracking Endpoints
// ==========================================
const panvayaController = require('../controllers/panvayaController');
router.post('/panvaya/track', panvayaController.trackOcean);
router.get('/panvaya/carriers', panvayaController.getCarriers);
router.post('/panvaya/schedules', panvayaController.getSchedules);
router.get('/panvaya/vessels', panvayaController.getVesselDetails);
router.get('/panvaya/vessels/position', panvayaController.getVesselPosition);
router.get('/panvaya/port-congestion', panvayaController.getPortCongestion);
router.post('/panvaya/carbon', panvayaController.calculateCarbon);
router.post('/panvaya/distance-time', panvayaController.calculateDistanceTime);
router.get('/panvaya/usage', panvayaController.getUsage);

module.exports = router;

