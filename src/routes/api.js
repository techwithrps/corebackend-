const express = require('express');
const router = express.Router();
const cirController = require('../controllers/cirController');

router.get('/health', cirController.checkHealth);
router.get('/cir-report', cirController.getCIRReport);
router.get('/financial-analytics', cirController.getFinancialAnalytics);
router.get('/containers', cirController.getContainers);
router.get('/masters', cirController.getMasters);
router.get('/fleet', cirController.getFleet);
router.get('/operations', cirController.getOperations);
router.get('/export/excel', cirController.exportExcel);
router.post('/sync-warehouse', cirController.syncWarehouse);
router.get('/warehouse-status', cirController.getWarehouseStatus);
router.get('/cache-stats', (req, res) => {
  const cacheService = require('../services/cacheService');
  res.json({ success: true, data: cacheService.stats() });
});
router.post('/cache-flush', (req, res) => {
  const cacheService = require('../services/cacheService');
  cacheService.clear();
  res.json({ success: true, message: 'All in-memory cache flushed successfully' });
});

module.exports = router;
