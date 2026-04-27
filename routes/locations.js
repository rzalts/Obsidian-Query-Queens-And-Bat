const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/location', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    let locations = [];
    const search = req.query.search || '';
    const sort = req.query.sort || 'location_id';
    const allowed = ['location_id','location_name','location_address'];
    const sort_col = allowed.includes(sort) ? sort : 'location_id';
    if (show_id) {
      let sql = `SELECT DISTINCT l.* FROM fit_location l JOIN item i ON i.location_id = l.location_id JOIN show_event se ON se.collection_id = i.collection_id WHERE se.show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND (l.location_name LIKE ? OR l.location_address LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY l.${sort_col}`;
      [locations] = await db.query(sql, p);
    } else if (req.session.user.role === 'developer') {
      let sql = `SELECT * FROM fit_location WHERE 1=1`;
      let p = [];
      if (search) { sql += ` AND (location_name LIKE ? OR location_address LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY ${sort_col}`;
      [locations] = await db.query(sql, p);
    }
    res.render('location', { locations, show_id, search, sort: sort_col });
  } catch (err) {
    console.error(err);
    res.render('location', { locations: [], show_id, search: '', sort: 'location_id' });
  }
});

router.get('/location/export', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const [rows] = show_id
      ? await db.query(`SELECT DISTINCT l.* FROM fit_location l JOIN item i ON i.location_id = l.location_id JOIN show_event se ON se.collection_id = i.collection_id WHERE se.show_id = ? ORDER BY l.location_id`, [show_id])
      : await db.query(`SELECT * FROM fit_location ORDER BY location_id`);
    const headers = ['location_id','location_name','location_address'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="locations_export.csv"');
    res.send(csv);
  } catch(err) { console.error(err); res.redirect(`/location${show_id?`?show_id=${show_id}`:''}`); }
});

router.get('/locationadd', requireLogin, (req, res) =>
  res.render('locationadd', { show_id: req.query.show_id })
);

router.post('/locationadd', requireLogin, async (req, res) => {
  const { location_name, location_address, show_id } = req.body;
  try {
    await db.query(
      'INSERT INTO fit_location (location_name, location_address) VALUES (?, ?)',
      [location_name, location_address]
    );
    req.flash('success', 'Location added.');
    res.redirect(`/location${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add location.');
    res.redirect('/locationadd');
  }
});

router.get('/locationdelete', requireLogin, (req, res) =>
  res.render('locationdelete', { show_id: req.query.show_id })
);

router.post('/locationdelete', requireLogin, async (req, res) => {
  const { location_id, show_id } = req.body;
  try {
    await db.query('DELETE FROM fit_location WHERE location_id = ?', [location_id]);
    req.flash('success', 'Location deleted.');
    res.redirect(`/location${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete location.');
    res.redirect('/locationdelete');
  }
});

module.exports = router;
