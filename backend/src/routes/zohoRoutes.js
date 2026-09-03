const express = require('express');
const router = express.Router();
const zohoController = require('../controllers/zohoController');
const authenticate = require('../middlewares/authenticate');

router.use(authenticate);

// App discovery for dashboard
router.get('/apps', zohoController.getMyApps);

// Open app (returns redirectUrl and logs audit event)
router.post('/:appKey/open', zohoController.open);

// Proxy requests to Zoho services
router.all('/:appKey/proxy*', zohoController.proxy);

module.exports = router;
