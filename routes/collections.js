const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/collection', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  const search = req.query.search || '';
  const sort = req.query.sort || 'collection_id';
  const allowed = ['collection_id','collection_name','brand','season','collection_year','collection_status'];
  const sort_col = allowed.includes(sort) ? sort : 'collection_id';
  try {
    let collections = [];
    if (show_id) {
      // count_looks() is a stored SQL function — counts looks in a collection
      let sql = `SELECT c.*, count_looks(c.collection_id) AS look_count
                 FROM fit_collection c JOIN show_event se ON se.collection_id = c.collection_id
                 WHERE se.show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND (c.collection_name LIKE ? OR c.brand LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY c.${sort_col}`;
      [collections] = await db.query(sql, p);
    } else if (req.session.user.role === 'developer') {
      let sql = `SELECT c.*, count_looks(c.collection_id) AS look_count FROM fit_collection c WHERE 1=1`;
      let p = [];
      if (search) { sql += ` AND (c.collection_name LIKE ? OR c.brand LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY c.${sort_col}`;
      [collections] = await db.query(sql, p);
    }
    res.render('collection', { collections, show_id, search, sort: sort_col });
  } catch (err) {
    console.error(err);
    res.render('collection', { collections: [], show_id, search: '', sort: 'collection_id' });
  }
});

router.get('/collection/export', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const [rows] = show_id
      ? await db.query(`SELECT c.* FROM fit_collection c JOIN show_event se ON se.collection_id = c.collection_id WHERE se.show_id = ? ORDER BY c.collection_id`, [show_id])
      : await db.query(`SELECT * FROM fit_collection ORDER BY collection_id`);
    const headers = ['collection_id','collection_name','brand','season','collection_year','collection_status'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="collections_export.csv"');
    res.send(csv);
  } catch(err) { console.error(err); res.redirect(`/collection${show_id?`?show_id=${show_id}`:''}`); }
});

router.get('/collectionadd', requireLogin, (req, res) =>
  res.render('collectionadd', { show_id: req.query.show_id })
);

router.post('/collectionadd', requireLogin, async (req, res) => {
  const { collection_name, brand, season, collection_year, collection_status, show_id } = req.body;
  try {
    await db.query(
      'INSERT INTO fit_collection (collection_name, brand, season, collection_year, collection_status) VALUES (?, ?, ?, ?, ?)',
      [collection_name, brand, season, collection_year, collection_status]
    );
    req.flash('success', 'Collection added.');
    res.redirect(`/collection${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add collection.');
    res.redirect('/collectionadd');
  }
});

router.get('/collectiondelete', requireLogin, (req, res) =>
  res.render('collectiondelete', { show_id: req.query.show_id })
);

router.post('/collectiondelete', requireLogin, async (req, res) => {
  const { collection_id, show_id } = req.body;
  try {
    await db.query('DELETE FROM fit_collection WHERE collection_id = ?', [collection_id]);
    req.flash('success', 'Collection deleted.');
    res.redirect(`/collection${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete. Collection may have dependent records.');
    res.redirect('/collectiondelete');
  }
});

router.get('/collectionstatus', requireLogin, (req, res) =>
  res.render('collectionstatus', { show_id: req.query.show_id })
);

router.post('/collectionstatus', requireLogin, async (req, res) => {
  const { collection_id, new_status, show_id } = req.body;
  try {
    await db.query(
      'UPDATE fit_collection SET collection_status = ? WHERE collection_id = ?',
      [new_status, collection_id]
    );
    req.flash('success', 'Status updated.');
    res.redirect(`/collection${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update status.');
    res.redirect('/collectionstatus');
  }
});

module.exports = router;
