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
        (SELECT COUNT(*) FROM alteration)       AS total_alterations,
        (SELECT COUNT(*) FROM fit_location)     AS total_locations
    `);

    // Per-show breakdown — each show with its collection and all associated counts
    const [showBreakdown] = await db.query(`
      SELECT
        se.show_id,
        se.show_name,
        se.show_date,
        se.venue,
        CONCAT(sc.first_name, ' ', sc.last_name) AS coordinator_name,
        c.collection_name,
        (SELECT COUNT(*) FROM fashion_look fl WHERE fl.collection_id = se.collection_id)                                      AS look_count,
        (SELECT COUNT(*) FROM item i WHERE i.collection_id = se.collection_id)                                                AS item_count,
        (SELECT COUNT(DISTINCT m.model_id) FROM model m JOIN fashion_look fl ON fl.model_id = m.model_id WHERE fl.collection_id = se.collection_id) AS model_count,
        (SELECT COUNT(*) FROM fitting f JOIN fashion_look fl ON f.look_id = fl.look_id WHERE fl.collection_id = se.collection_id) AS fitting_count,
        (SELECT COUNT(*) FROM alteration a JOIN item i ON a.item_id = i.item_id WHERE i.collection_id = se.collection_id)     AS alteration_count,
        (SELECT COUNT(*) FROM show_order so WHERE so.show_id = se.show_id)                                                    AS order_count,
        (SELECT COUNT(DISTINCT i.location_id) FROM item i WHERE i.collection_id = se.collection_id)                          AS location_count
      FROM show_event se
      LEFT JOIN fit_collection c ON c.collection_id = se.collection_id
      LEFT JOIN show_coordinator sc ON sc.user_id = se.user_id
      ORDER BY se.show_date DESC
    `);

    res.render('admin', { coordinators, stats: totals[0], showBreakdown });
  } catch (err) {
    console.error(err);
    res.render('admin', { coordinators: [], stats: {}, showBreakdown: [] });
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

router.post('/myshowsregistration', requireLogin, async (req, res) => {
  const { show_name, show_date, venue, show_address, start_time, end_time,
          collection_name, brand, season, collection_year, card_color } = req.body;
  try {
    // 1) Create a brand-new collection exclusively for this show
    const [colResult] = await db.query(
      'INSERT INTO fit_collection (collection_name, brand, season, collection_year, collection_status) VALUES (?, ?, ?, ?, ?)',
      [collection_name, brand || null, season || null, collection_year || null, 'Pending']
    );
    const new_collection_id = colResult.insertId;

    // 2) Get next available show_id for the stored procedure
    const [[{ next_id }]] = await db.query('SELECT COALESCE(MAX(show_id), 0) + 1 AS next_id FROM show_event');

    // 3) Call stored procedure ScheduleShow with the freshly created collection
    const [results] = await db.query(
      'CALL ScheduleShow(?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [next_id, new_collection_id, req.session.user.id,
       show_name, show_date, venue || null, show_address || null,
       start_time || null, end_time || null]
    );
    const msg = Object.values(results[0][0])[0];
    if (String(msg).startsWith('Error:')) {
      // Roll back the collection we just created
      await db.query('DELETE FROM fit_collection WHERE collection_id = ?', [new_collection_id]);
      req.flash('error', msg);
      return res.redirect('/myshowsregistration');
    }

    // Save chosen card color
    if (card_color) {
      await db.query('UPDATE show_event SET card_color = ? WHERE show_id = ?', [card_color, next_id]);
    }

    req.flash('success', 'Show scheduled successfully.');
    res.redirect('/myshows');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add show.');
    res.redirect('/myshowsregistration');
  }
});

// Update card color for an existing show
router.post('/showcolor', requireLogin, async (req, res) => {
  const { show_id, card_color } = req.body;
  const allowed = ['#111111', '#1B2A4A', '#6B6560', '#F5F0E8'];
  if (!allowed.includes(card_color)) return res.redirect('/myshows');
  try {
    await db.query(
      'UPDATE show_event SET card_color = ? WHERE show_id = ? AND user_id = ?',
      [card_color, show_id, req.session.user.id]
    );
  } catch (err) { console.error(err); }
  res.redirect('/myshows');
});

router.get('/myshowsdelete', requireLogin, async (req, res) => {
  try {
    const [shows] = await db.query(
      'SELECT show_id, show_name, show_date FROM show_event WHERE user_id = ? ORDER BY show_date DESC',
      [req.session.user.id]
    );
    res.render('myshowsdelete', { shows });
  } catch (err) {
    console.error(err);
    res.render('myshowsdelete', { shows: [] });
  }
});

router.post('/myshowsdelete', requireLogin, async (req, res) => {
  const { show_id } = req.body;
  try {
    // Delete dependent show_order records first to avoid foreign key errors
    await db.query('DELETE FROM show_order WHERE show_id = ?', [show_id]);
    // Now delete the show (only if it belongs to this user)
    await db.query(
      'DELETE FROM show_event WHERE show_id = ? AND user_id = ?',
      [show_id, req.session.user.id]
    );
    req.flash('success', 'Show deleted.');
    res.redirect('/myshows');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete show.');
    res.redirect('/myshowsdelete');
  }
});

// Edit show
router.get('/myshowsedit/:show_id', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM show_event WHERE show_id = ? AND user_id = ?',
      [req.params.show_id, req.session.user.id]
    );
    if (!rows.length) return res.redirect('/myshows');
    res.render('myshowsedit', { show: rows[0] });
  } catch (err) {
    console.error(err);
    res.redirect('/myshows');
  }
});

router.post('/myshowsedit/:show_id', requireLogin, async (req, res) => {
  const { show_name, show_date, venue, show_address, start_time, end_time, card_color } = req.body;
  const show_id = req.params.show_id;
  try {
    await db.query(
      `UPDATE show_event SET show_name=?, show_date=?, venue=?, show_address=?,
       start_time=?, end_time=?, card_color=?
       WHERE show_id=? AND user_id=?`,
      [show_name, show_date || null, venue, show_address || null,
       start_time || null, end_time || null, card_color || '#111111',
       show_id, req.session.user.id]
    );
    req.flash('success', 'Show updated.');
    res.redirect(`/mymenu/${show_id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update show.');
    res.redirect(`/myshowsedit/${show_id}`);
  }
});

router.post('/admin/deletecoordinator', requireLogin, async (req, res) => {
  if (req.session.user.role !== 'developer') return res.redirect('/myshows');
  const { user_id } = req.body;
  try {
    // Verify target is not a developer before deleting
    const [[target]] = await db.query('SELECT reg_role FROM show_coordinator WHERE user_id = ?', [user_id]);
    if (!target || target.reg_role === 'developer') {
      req.flash('error', 'Cannot delete a developer account.');
      return res.redirect('/admin');
    }
    // Delete their shows' orders first, then shows, then the coordinator
    const [shows] = await db.query('SELECT show_id FROM show_event WHERE user_id = ?', [user_id]);
    for (const s of shows) {
      await db.query('DELETE FROM show_order WHERE show_id = ?', [s.show_id]);
    }
    await db.query('DELETE FROM show_event WHERE user_id = ?', [user_id]);
    await db.query('DELETE FROM show_coordinator WHERE user_id = ?', [user_id]);
    req.flash('success', 'Coordinator deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete coordinator.');
  }
  res.redirect('/admin');
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
