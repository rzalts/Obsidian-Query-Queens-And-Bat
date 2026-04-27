const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, `show_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Developer-only admin dashboard
router.get('/admin', requireLogin, async (req, res) => {
  if (req.session.user.role !== 'developer') return res.redirect('/myshows');
  try {
    const [coordinators] = await db.query(`
      SELECT
        sc.user_id,
        sc.first_name,
        sc.last_name,
        sc.email,
        sc.phone_number,
        sc.reg_role,
        COUNT(se.show_id) AS show_count
      FROM show_coordinator sc
      LEFT JOIN show_event se ON se.user_id = sc.user_id
      GROUP BY sc.user_id
      ORDER BY show_count DESC
    `);

    const [totals] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM show_coordinator) AS total_coordinators,
        (SELECT COUNT(*) FROM show_event)       AS total_shows,
        (SELECT COUNT(*) FROM fit_collection)   AS total_collections,
        (SELECT COUNT(*) FROM fashion_look)     AS total_looks,
        (SELECT COUNT(*) FROM item)             AS total_items,
        (SELECT COUNT(*) FROM model)            AS total_models,
        (SELECT COUNT(*) FROM fitting)          AS total_fittings,
        (SELECT COUNT(*) FROM alteration)       AS total_alterations
    `);

    res.render('admin', { coordinators, stats: totals[0] });
  } catch (err) {
    console.error(err);
    res.render('admin', { coordinators: [], stats: {} });
  }
});

router.get('/myshows', requireLogin, async (req, res) => {
  try {
    // is_show_ready() is a stored SQL function — returns 1 if show has coordinator + sequence
    const [shows] = await db.query(
      req.session.user.role === 'developer'
        ? `SELECT se.*, CONCAT(sc.first_name,' ',sc.last_name) AS coordinator_name,
                  is_show_ready(se.show_id) AS ready
           FROM show_event se
           LEFT JOIN show_coordinator sc ON sc.user_id = se.user_id
           ORDER BY se.show_date DESC`
        : `SELECT se.*, is_show_ready(se.show_id) AS ready
           FROM show_event se WHERE user_id = ? ORDER BY show_date DESC`,
      req.session.user.role === 'developer' ? [] : [req.session.user.id]
    );
    res.render('myshows', { shows, isAdmin: req.session.user.role === 'developer' });
  } catch (err) {
    console.error(err);
    res.render('myshows', { shows: [], isAdmin: false });
  }
});

router.get('/myshowsregistration', requireLogin, (req, res) => res.render('myshowsregistration'));

router.post('/myshowsregistration', requireLogin, upload.single('logo'), async (req, res) => {
  const { show_name, show_date, venue, show_address, start_time, end_time, collection_id } = req.body;
  const logo_path = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    // Get next available show_id for the stored procedure
    const [[{ next_id }]] = await db.query('SELECT COALESCE(MAX(show_id), 0) + 1 AS next_id FROM show_event');

    // Call stored procedure ScheduleShow — validates coordinator, collection, and times
    const [results] = await db.query(
      'CALL ScheduleShow(?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [next_id, collection_id || null, req.session.user.id,
       show_name, show_date, venue || null, show_address || null,
       start_time || null, end_time || null]
    );
    const msg = Object.values(results[0][0])[0];
    if (String(msg).startsWith('Error:')) {
      req.flash('error', msg);
      return res.redirect('/myshowsregistration');
    }
    // Store the uploaded logo (procedure doesn't handle files, so update separately)
    if (logo_path) {
      await db.query('UPDATE show_event SET logo_path = ? WHERE show_id = ?', [logo_path, next_id]);
    }
    req.flash('success', 'Show scheduled successfully.');
    res.redirect('/myshows');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add show.');
    res.redirect('/myshowsregistration');
  }
});

router.get('/myshowsdelete', requireLogin, (req, res) => res.render('myshowsdelete'));

router.post('/myshowsdelete', requireLogin, async (req, res) => {
  const { show_name, show_date, venue } = req.body;
  try {
    await db.query(
      'DELETE FROM show_event WHERE show_name = ? AND show_date = ? AND venue = ? AND user_id = ?',
      [show_name, show_date, venue, req.session.user.id]
    );
    req.flash('success', 'Show deleted.');
    res.redirect('/myshows');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete show.');
    res.redirect('/myshowsdelete');
  }
});

router.get('/mymenu/:show_id', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM show_event WHERE show_id = ?', [req.params.show_id]);
    if (!rows.length) return res.redirect('/myshows');
    res.render('mymenu', { show: rows[0] });
  } catch (err) {
    console.error(err);
    res.redirect('/myshows');
  }
});

router.get('/mymenudetail/:show_id', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM show_event WHERE show_id = ?', [req.params.show_id]);
    if (!rows.length) return res.redirect('/myshows');
    res.render('mymenudetail', { show: rows[0] });
  } catch (err) {
    console.error(err);
    res.redirect('/myshows');
  }
});

module.exports = router;
