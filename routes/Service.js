const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/Service.js');
const auth = require('../middlewares/Auth.js');

router.post('/', serviceController.createService);
router.get('/', serviceController.getAllServices);

router.get('/getCategories', serviceController.getAllServiceCategories);
router.get('/category/:category', serviceController.getServicesByCategory);
router.get('/:id', serviceController.getServiceById);

router.put('/:id', auth(["admin"]), serviceController.updateService);
router.delete('/:id', auth(["admin"]), serviceController.deleteService);

module.exports = router;
