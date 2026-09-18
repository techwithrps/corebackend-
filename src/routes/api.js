const express = require('express');
const router = express.Router();
const cirController = require('../controllers/cirController');

router.get('/health', cirController.checkHealth);
router.get('/cir-report', cirController.getCIRReport);
router.get('/financial-analytics', cirController.getFinancialAnalytics);
router.get('/containers', cirController.getContainers);
router.get('/masters', cirController.getMasters);
router.get('/operations', cirController.getOperations);
router.get('/export/excel', cirController.exportExcel);

module.exports = router;
