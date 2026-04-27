function requireLogin(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!req.session.user) return res.redirect('/login');
  next();
}

module.exports = { requireLogin };
