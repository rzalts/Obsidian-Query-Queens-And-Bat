function requireLogin(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Middleware: if a show_id is in the query or body, verify it belongs to this user (coordinators only)
function requireShowOwnership(db) {
  return async (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (user.role === 'developer') return next(); // developers can see everything
    const show_id = req.query.show_id || req.body.show_id;
    if (!show_id) return next(); // no show context, pass through
    try {
      const [rows] = await db.query(
        'SELECT show_id FROM show_event WHERE show_id = ? AND user_id = ?',
        [show_id, user.user_id]
      );
      if (!rows.length) return res.redirect('/myshows');
      next();
    } catch (err) {
      console.error(err);
      res.redirect('/myshows');
    }
  };
}

module.exports = { requireLogin, requireShowOwnership };
