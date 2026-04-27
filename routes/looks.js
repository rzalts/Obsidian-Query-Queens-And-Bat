const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/look', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  const search = req.query.search || '';
  const sort = req.query.sort || 'look_id';
  const allowed = ['look_id','look_category','look_description'];
  const sort_col = allowed.includes(sort) ? sort : 'look_id';
  try {
    let looks = [];
    if (show_id) {
      let sql = `SELECT l.* FROM fashion_look l JOIN show_event se ON se.collection_id = l.collection_id WHERE se.show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND (l.look_category LIKE ? OR l.look_description LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY l.${sort_col}`;
      [looks] = await db.query(sql, p);
    } else if (req.session.user.role === 'developer') {
      let sql = `SELECT * FROM fashion_look WHERE 1=1`;
      let p = [];
      if (search) { sql += ` AND (look_category LIKE ? OR look_description LIKE ?)`; p.push(`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY ${sort_col}`;
      [looks] = await db.query(sql, p);
    }
    res.render('look', { looks, show_id, search, sort: sort_col });
  } catch (err) {
    console.error(err);
    res.render('look', { looks: [], show_id, search: '', sort: 'look_id' });
  }
});

router.get('/look/export', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const [rows] = show_id
      ? await db.query(`SELECT l.* FROM fashion_look l JOIN show_event se ON se.collection_id = l.collection_id WHERE se.show_id = ? ORDER BY l.look_id`, [show_id])
      : await db.query(`SELECT * FROM fashion_look ORDER BY look_id`);
    const headers = ['look_id','collection_id','model_id','look_category','look_description'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="looks_export.csv"');
    res.send(csv);
  } catch(err) { console.error(err); res.redirect(`/look${show_id?`?show_id=${show_id}`:''}`); }
});

router.get('/lookadd', requireLogin, (req, res) =>
  res.render('lookadd', { show_id: req.query.show_id })
);

router.post('/lookadd', requireLogin, async (req, res) => {
  const { collection_id, model_id, look_category, look_description, show_id } = req.body;
  try {
    await db.query(
      'INSERT INTO fashion_look (collection_id, model_id, look_category, look_description) VALUES (?, ?, ?, ?)',
      [collection_id, model_id, look_category, look_description]
    );
    req.flash('success', 'Look added.');
    res.redirect(`/look${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add look.');
    res.redirect('/lookadd');
  }
});

router.get('/lookdelete', requireLogin, (req, res) =>
  res.render('lookdelete', { show_id: req.query.show_id })
);

router.post('/lookdelete', requireLogin, async (req, res) => {
  const { look_id, show_id } = req.body;
  try {
    await db.query('DELETE FROM fashion_look WHERE look_id = ?', [look_id]);
    req.flash('success', 'Look deleted.');
    res.redirect(`/look${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete look.');
    res.redirect('/lookdelete');
  }
});

module.exports = router;
