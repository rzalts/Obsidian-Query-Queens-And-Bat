const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/showorder', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  try {
    const query = show_id
      ? 'SELECT * FROM show_order WHERE show_id = ? ORDER BY sequence_number'
      : 'SELECT * FROM show_order ORDER BY show_id, sequence_number';
    const params = show_id ? [show_id] : [];
    const [orders] = await db.query(query, params);
    res.render('showorder', { orders, show_id });
  } catch (err) {
    console.error(err);
    res.render('showorder', { orders: [], show_id });
  }
});

router.get('/showorderadd', requireLogin, async (req, res) => {
  const show_id = req.query.show_id;
  let suggested_seq = 1;
  if (show_id) {
    try {
      // next_sequence() is a stored SQL function — returns MAX(sequence_number)+1 for a show
      const [[row]] = await db.query('SELECT next_sequence(?) AS next_seq', [show_id]);
      suggested_seq = row.next_seq || 1;
    } catch (e) { /* use default 1 */ }
  }
  res.render('showorderadd', { show_id, suggested_seq });
});

router.post('/showorderadd', requireLogin, async (req, res) => {
  const { show_id, look_id, sequence_number } = req.body;
  try {
    // Get next available show_order_id for the stored procedure
    const [[{ next_id }]] = await db.query('SELECT COALESCE(MAX(show_order_id), 0) + 1 AS next_id FROM show_order');

    // Call stored procedure ShowSequenceCheck — validates show, look, and duplicate sequence
    const [results] = await db.query(
      'CALL ShowSequenceCheck(?, ?, ?, ?)',
      [next_id, show_id, look_id, sequence_number]
    );
    const msg = Object.values(results[0][0])[0];
    if (String(msg).startsWith('Error:')) {
      req.flash('error', msg);
      return res.redirect(`/showorderadd?show_id=${show_id}`);
    }
    req.flash('success', 'Show order entry added.');
    res.redirect(`/showorder?show_id=${show_id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add. Sequence number may be duplicate.');
    res.redirect(`/showorderadd?show_id=${show_id}`);
  }
});

router.get('/showorderdelete', requireLogin, (req, res) =>
  res.render('showorderdelete', { show_id: req.query.show_id })
);

router.post('/showorderdelete', requireLogin, async (req, res) => {
  const { show_order_id, show_id, look_id } = req.body;
  try {
    await db.query(
      'DELETE FROM show_order WHERE show_order_id = ? AND show_id = ? AND look_id = ?',
      [show_order_id, show_id, look_id]
    );
    req.flash('success', 'Show order entry deleted.');
    res.redirect(`/showorder?show_id=${show_id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete show order entry.');
    res.redirect('/showorderdelete');
  }
});

module.exports = router;
