const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/fitting', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  const search = req.query.search || '';
  const sort = req.query.sort || 'fitting_id';
  const allowed = ['fitting_id','fitting_date','fitting_status'];
  const sort_col = allowed.includes(sort) ? sort : 'fitting_id';
  try {
    let fittings = [];
    if (show_id) {
      let sql = `SELECT f.* FROM fitting f JOIN fashion_look l ON l.look_id = f.look_id JOIN show_event se ON se.collection_id = l.collection_id WHERE se.show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND f.fitting_status LIKE ?`; p.push(`%${search}%`); }
      sql += ` ORDER BY f.${sort_col}`;
      [fittings] = await db.query(sql, p);
    } else if (req.session.user.role === 'developer') {
      let sql = `SELECT * FROM fitting WHERE 1=1`;
      let p = [];
      if (search) { sql += ` AND fitting_status LIKE ?`; p.push(`%${search}%`); }
      sql += ` ORDER BY ${sort_col}`;
      [fittings] = await db.query(sql, p);
    }
    res.render('fitting', { fittings, show_id, search, sort: sort_col });
  } catch (err) {
    console.error(err);
    res.render('fitting', { fittings: [], show_id, search: '', sort: 'fitting_id' });
  }
});

router.get('/fitting/export', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const [rows] = show_id
      ? await db.query(`SELECT f.* FROM fitting f JOIN fashion_look l ON l.look_id = f.look_id JOIN show_event se ON se.collection_id = l.collection_id WHERE se.show_id = ? ORDER BY f.fitting_id`, [show_id])
      : await db.query(`SELECT * FROM fitting ORDER BY fitting_id`);
    const headers = ['fitting_id','look_id','fitting_date','fitting_status'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="fittings_export.csv"');
    res.send(csv);
  } catch(err) { console.error(err); res.redirect(`/fitting${show_id?`?show_id=${show_id}`:''}`); }
});

router.get('/fittingadd', requireLogin, (req, res) =>
  res.render('fittingadd', { show_id: req.query.show_id })
);

router.post('/fittingadd', requireLogin, async (req, res) => {
  const { look_id, fitting_date, fitting_status, show_id } = req.body;
  try {
    // Get next available fitting_id for the stored procedure
    const [[{ next_id }]] = await db.query('SELECT COALESCE(MAX(fitting_id), 0) + 1 AS next_id FROM fitting');

    // Call stored procedure FittingAppointment — validates look exists, checks duplicate
    const [results] = await db.query(
      'CALL FittingAppointment(?, ?, ?, ?)',
      [next_id, look_id, fitting_date || null, fitting_status]
    );
    const msg = Object.values(results[0][0])[0];
    if (String(msg).startsWith('Error:')) {
      req.flash('error', msg);
      return res.redirect(`/fittingadd${show_id ? `?show_id=${show_id}` : ''}`);
    }
    req.flash('success', 'Fitting scheduled.');
    res.redirect(`/fitting${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add fitting. Check that Look ID exists.');
    res.redirect('/fittingadd');
  }
});

router.get('/fittingdelete', requireLogin, (req, res) =>
  res.render('fittingdelete', { show_id: req.query.show_id })
);

router.post('/fittingdelete', requireLogin, async (req, res) => {
  const { fitting_id, show_id } = req.body;
  try {
    await db.query('DELETE FROM fitting WHERE fitting_id = ?', [fitting_id]);
    req.flash('success', 'Fitting deleted.');
    res.redirect(`/fitting${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete fitting.');
    res.redirect('/fittingdelete');
  }
});

router.get('/fittingstatus', requireLogin, (req, res) =>
  res.render('fittingstatus', { show_id: req.query.show_id })
);

router.post('/fittingstatus', requireLogin, async (req, res) => {
  const { fitting_id, new_status, show_id } = req.body;
  try {
    await db.query(
      'UPDATE fitting SET fitting_status = ? WHERE fitting_id = ?',
      [new_status, fitting_id]
    );
    req.flash('success', 'Fitting status updated.');
    res.redirect(`/fitting${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update fitting status.');
    res.redirect('/fittingstatus');
  }
});

module.exports = router;
