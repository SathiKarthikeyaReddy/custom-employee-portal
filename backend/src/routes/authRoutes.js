const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/authenticate');
const { loginRateLimiter } = require('../middlewares/rateLimiter');

router.post('/login', loginRateLimiter, authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
