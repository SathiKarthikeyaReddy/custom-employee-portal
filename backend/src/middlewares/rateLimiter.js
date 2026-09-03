const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true' || req.headers['x-test-bypass'] === 'true',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

module.exports = {
  loginRateLimiter,
};
