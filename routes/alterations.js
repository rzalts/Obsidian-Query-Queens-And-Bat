const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/alteration', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    let alterations = [];
    const search = req.query.search || '';
    const sort = req.query.sort || 'alteration_id';
    const allowed = ['alteration_id','alteration_type','date_needed_by','alteration_status'];
    const sort_col = allowed.includes(sort) ? sort : 'alteration_id';
    if (show_id) {
      let sql = `SELECT a.* FROM alteration a JOIN item i ON i.item_id = a.item_id JOIN show_event se ON se.collection_id = i.collection_id WHERE se.show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND (a.alteration_type LIKE ? OR a.alteration_status LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY a.${sort_col}`;
      [alterations] = await db.query(sql, p);
    } else if (req.session.user.role === 'developer') {
      let sql = `SELECT * FROM alteration WHERE 1=1`;
      let p = [];
      if (search) { sql += ` AND (alteration_type LIKE ? OR alteration_status LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY ${sort_col}`;
      [alterations] = await db.query(sql, p);
    }
    res.render('alteration', { alterations, show_id, search, sort: sort_col });
  } catch (err) {
    console.error(err);
    res.render('alteration', { alterations: [], show_id, search: '', sort: 'alteration_id' });
  }
});

router.get('/alteration/export', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const [rows] = show_id
      ? await db.query(`SELECT a.* FROM alteration a JOIN item i ON i.item_id = a.item_id JOIN show_event se ON se.collection_id = i.collection_id WHERE se.show_id = ? ORDER BY a.alteration_id`, [show_id])
      : await db.query(`SELECT * FROM alteration ORDER BY alteration_id`);
    const headers = ['alteration_id','item_id','fitting_id','alteration_type','date_needed_by','alteration_status'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="alterations_export.csv"');
    res.send(csv);
  } catch(err) { console.error(err); res.redirect(`/alteration${show_id?`?show_id=${show_id}`:''}`); }
});

router.get('/alterationadd', requireLogin, (req, res) =>
  res.render('alterationadd', { show_id: req.query.show_id })
);

router.post('/alterationadd', requireLogin, async (req, res) => {
  const { item_id, fitting_id, alteration_type, date_needed_by, alteration_status, show_id } = req.body;
  try {
    await db.query(
      'INSERT INTO alteration (item_id, fitting_id, alteration_type, date_needed_by, alteration_status) VALUES (?, ?, ?, ?, ?)',
      [item_id, fitting_id, alteration_type, date_needed_by, alteration_status]
    );
    req.flash('success', 'Alteration added.');
    res.redirect(`/alteration${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add alteration.');
    res.redirect('/alterationadd');
  }
});

router.get('/alterationdelete', requireLogin, (req, res) =>
  res.render('alterationdelete', { show_id: req.query.show_id })
);

router.post('/alterationdelete', requireLogin, async (req, res) => {
  const { alteration_id, show_id } = req.body;
  try {
    await db.query('DELETE FROM alteration WHERE alteration_id = ?', [alteration_id]);
    req.flash('success', 'Alteration deleted.');
    res.redirect(`/alteration${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete alteration.');
    res.redirect('/alterationdelete');
  }
});

router.get('/alterationstatus', requireLogin, (req, res) =>
  res.render('alterationstatus', { show_id: req.query.show_id })
);

router.post('/alterationstatus', requireLogin, async (req, res) => {
  const { alteration_id, new_status, show_id } = req.body;
  try {
    await db.query(
      'UPDATE alteration SET alteration_status = ? WHERE alteration_id = ?',
      [new_status, alteration_id]
    );
    req.flash('success', 'Status updated.');
    res.redirect(`/alteration${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update status.');
    res.redirect('/alterationstatus');
  }
});

module.exports = router;
