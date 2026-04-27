const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/model', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  const search = req.query.search || '';
  const sort = req.query.sort || 'model_id';
  const allowed = ['model_id','first_name','last_name','agency'];
  const sort_col = allowed.includes(sort) ? sort : 'model_id';
  try {
    let models = [];
    if (show_id) {
      let sql = `SELECT DISTINCT m.* FROM model m JOIN fashion_look l ON l.model_id = m.model_id JOIN show_event se ON se.collection_id = l.collection_id WHERE se.show_id = ?`;
      let p = [show_id];
      if (search) { sql += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.agency LIKE ?)`; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY m.${sort_col}`;
      [models] = await db.query(sql, p);
    } else if (req.session.user.role === 'developer') {
      let sql = `SELECT * FROM model WHERE 1=1`;
      let p = [];
      if (search) { sql += ` AND (first_name LIKE ? OR last_name LIKE ? OR agency LIKE ?)`; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
      sql += ` ORDER BY ${sort_col}`;
      [models] = await db.query(sql, p);
    }
    res.render('model', { models, show_id, search, sort: sort_col });
  } catch (err) {
    console.error(err);
    res.render('model', { models: [], show_id, search: '', sort: 'model_id' });
  }
});

router.get('/model/export', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const [rows] = show_id
      ? await db.query(`SELECT DISTINCT m.* FROM model m JOIN fashion_look l ON l.model_id = m.model_id JOIN show_event se ON se.collection_id = l.collection_id WHERE se.show_id = ? ORDER BY m.model_id`, [show_id])
      : await db.query(`SELECT * FROM model ORDER BY model_id`);
    const headers = ['model_id','first_name','last_name','agency','email','phone_number'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="models_export.csv"');
    res.send(csv);
  } catch(err) { console.error(err); res.redirect(`/model${show_id?`?show_id=${show_id}`:''}`); }
});

router.get('/modeladd', requireLogin, (req, res) =>
  res.render('modeladd', { show_id: req.query.show_id })
);

router.post('/modeladd', requireLogin, async (req, res) => {
  const { first_name, last_name, agency, email, phone_number, show_id } = req.body;
  try {
    await db.query(
      'INSERT INTO model (first_name, last_name, agency, email, phone_number) VALUES (?, ?, ?, ?, ?)',
      [first_name, last_name, agency, email, phone_number]
    );
    req.flash('success', 'Model added.');
    res.redirect(`/model${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add model.');
    res.redirect('/modeladd');
  }
});

router.get('/modeldelete', requireLogin, (req, res) =>
  res.render('modeldelete', { show_id: req.query.show_id })
);

router.post('/modeldelete', requireLogin, async (req, res) => {
  const { model_id, show_id } = req.body;
  try {
    await db.query('DELETE FROM model WHERE model_id = ?', [model_id]);
    req.flash('success', 'Model deleted.');
    res.redirect(`/model${show_id ? `?show_id=${show_id}` : ''}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete model.');
    res.redirect('/modeldelete');
  }
});

module.exports = router;
