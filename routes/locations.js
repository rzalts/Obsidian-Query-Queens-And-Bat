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
      let sql = `SELECT * FROM fit_location WHERE show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND (location_name LIKE ? OR location_address LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY ${sort_col}`;
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
      ? await db.query(`SELECT * FROM fit_location WHERE show_id = ? ORDER BY location_id`, [show_id])
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
      'INSERT INTO fit_location (location_name, location_address, show_id) VALUES (?, ?, ?)',
      [location_name, location_address, show_id || null]
    );
    req.flash('success', 'Location added.');
    res.redirect(`/location${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add location.');
    res.redirect('/locationadd');
  }
});

router.get('/locationdelete', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    let locations = [];
    if (show_id) {
      [locations] = await db.query(
        `SELECT location_id, location_name FROM fit_location WHERE show_id = ? ORDER BY location_id`, [show_id]);
    } else {
      [locations] = await db.query(
        `SELECT location_id, location_name FROM fit_location ORDER BY location_id`);
    }
    res.render('locationdelete', { show_id, locations });
  } catch (err) {
    console.error(err);
    res.render('locationdelete', { show_id, locations: [] });
  }
});

router.post('/locationdelete', requireLogin, async (req, res) => {
  const { location_id, show_id } = req.body;
  try {
    // Check if any items are still using this location
    const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM item WHERE location_id = ?', [location_id]);
    const cnt = Number(rows[0].cnt);
    console.log('[locationdelete] location_id:', location_id, 'linked items:', cnt);
    if (cnt > 0) {
      req.flash('error', `Cannot delete — ${cnt} item(s) are still assigned to this location.`);
      return res.redirect(`/locationdelete${show_id ? `?show_id=${show_id}` : ''}`);
    }
    await db.query('DELETE FROM fit_location WHERE location_id = ?', [location_id]);
    req.flash('success', 'Location deleted.');
    res.redirect(`/location${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete due to location tied item(s)');
    res.redirect(`/locationdelete${show_id ? `?show_id=${show_id}` : ''}`);
  }
});

module.exports = router;
