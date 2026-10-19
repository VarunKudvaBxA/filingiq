import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false });

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// Per-user, plan-aware. Must run AFTER requireAuth so req.user exists.
export const questionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: (req) => (req.user?.role === 'free' ? 20 : 200),
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hourly question limit reached. Pro accounts get a higher limit.' },
});
