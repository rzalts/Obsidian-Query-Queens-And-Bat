require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: false,
  });

  const objects = [
    // ── STORED PROCEDURES ──────────────────────────────────────────────────

    ['DROP PROCEDURE IF EXISTS ScheduleShow'],
    [`CREATE PROCEDURE ScheduleShow(
        IN ss_show_id INT,
        IN ss_collection_id INT,
        IN ss_user_id INT,
        IN ss_show_name VARCHAR(255),
        IN ss_show_date DATE,
        IN ss_venue VARCHAR(25),
        IN ss_show_address VARCHAR(50),
        IN ss_start_time TIME,
        IN ss_end_time TIME
      )
      BEGIN
        IF EXISTS (SELECT 1 FROM show_event WHERE show_id = ss_show_id) THEN
          SELECT 'Error: Show already exists';
        ELSEIF NOT EXISTS (SELECT 1 FROM fit_collection WHERE collection_id = ss_collection_id) THEN
          SELECT 'Error: Collection does not exist';
        ELSEIF NOT EXISTS (SELECT 1 FROM show_coordinator WHERE user_id = ss_user_id) THEN
          SELECT 'Error: Show Coordinator does not exist';
        ELSEIF ss_start_time >= ss_end_time THEN
          SELECT 'Error: Invalid Time(s)';
        ELSE
          INSERT INTO show_event (show_id, collection_id, user_id, show_name, show_date, venue, show_address, start_time, end_time)
          VALUES (ss_show_id, ss_collection_id, ss_user_id, ss_show_name, ss_show_date, ss_venue, ss_show_address, ss_start_time, ss_end_time);
          SELECT 'Show scheduled successfully';
        END IF;
      END`],

    ['DROP PROCEDURE IF EXISTS FittingAppointment'],
    [`CREATE PROCEDURE FittingAppointment(
        IN fa_fitting_id INT,
        IN fa_look_id INT,
        IN fa_fitting_date DATE,
        IN fa_status VARCHAR(12)
      )
      BEGIN
        IF EXISTS (SELECT 1 FROM fitting WHERE fitting_id = fa_fitting_id) THEN
          SELECT 'Error: Fitting already exists';
        ELSEIF NOT EXISTS (SELECT 1 FROM fashion_look WHERE look_id = fa_look_id) THEN
          SELECT 'Error: Look does not exist';
        ELSE
          INSERT INTO fitting (fitting_id, look_id, fitting_date, fitting_status)
          VALUES (fa_fitting_id, fa_look_id, fa_fitting_date, fa_status);
          SELECT 'Fitting scheduled successfully';
        END IF;
      END`],

    ['DROP PROCEDURE IF EXISTS ShowSequenceCheck'],
    [`CREATE PROCEDURE ShowSequenceCheck(
        IN ssc_show_order_id INT,
        IN ssc_show_id INT,
        IN ssc_look_id INT,
        IN ssc_sequence_number INT
      )
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM show_event WHERE show_id = ssc_show_id) THEN
          SELECT 'Error: Show does not exist';
        ELSEIF NOT EXISTS (SELECT 1 FROM fashion_look WHERE look_id = ssc_look_id) THEN
          SELECT 'Error: Look does not exist';
        ELSEIF EXISTS (SELECT 1 FROM show_order WHERE show_id = ssc_show_id AND sequence_number = ssc_sequence_number) THEN
          SELECT 'Error: Sequence number already assigned';
        ELSE
          INSERT INTO show_order (show_order_id, show_id, look_id, sequence_number)
          VALUES (ssc_show_order_id, ssc_show_id, ssc_look_id, ssc_sequence_number);
          SELECT 'Show order entry added successfully';
        END IF;
      END`],

    ['DROP PROCEDURE IF EXISTS MoveItem'],
    [`CREATE PROCEDURE MoveItem(
        IN mi_item_id INT,
        IN mi_location_id INT,
        IN mi_collection_id INT
      )
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM item WHERE item_id = mi_item_id) THEN
          SELECT 'Error: Item does not exist';
        ELSEIF NOT EXISTS (SELECT 1 FROM fit_collection WHERE collection_id = mi_collection_id) THEN
          SELECT 'Error: Collection does not exist';
        ELSEIF NOT EXISTS (SELECT 1 FROM item WHERE item_id = mi_item_id AND collection_id = mi_collection_id) THEN
          SELECT 'Error: Item does not belong to that Collection';
        ELSEIF NOT EXISTS (SELECT 1 FROM fit_location WHERE location_id = mi_location_id) THEN
          SELECT 'Error: Location does not exist';
        ELSE
          UPDATE item SET location_id = mi_location_id WHERE item_id = mi_item_id AND collection_id = mi_collection_id;
          SELECT 'Item moved successfully';
        END IF;
      END`],

    // ── TRIGGERS ───────────────────────────────────────────────────────────

    ['DROP TRIGGER IF EXISTS deleteCollectionIf'],
    [`CREATE TRIGGER deleteCollectionIf
      BEFORE DELETE ON fit_collection
      FOR EACH ROW
      BEGIN
        IF OLD.collection_id IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM fashion_look WHERE collection_id = OLD.collection_id)
          OR EXISTS (SELECT 1 FROM item WHERE collection_id = OLD.collection_id)
          OR EXISTS (SELECT 1 FROM show_event WHERE collection_id = OLD.collection_id) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Collection cannot be deleted. Dependent Look, Item, and/or Show still exist';
          END IF;
        END IF;
      END`],

    ['DROP TRIGGER IF EXISTS insertValidItemLocation'],
    [`CREATE TRIGGER insertValidItemLocation
      BEFORE INSERT ON item
      FOR EACH ROW
      BEGIN
        IF NEW.location_id IS NULL THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Item cannot be added. Enter a Location';
        ELSEIF NOT EXISTS (SELECT 1 FROM fit_location WHERE location_id = NEW.location_id) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Item cannot be added. Enter valid Location';
        END IF;
      END`],

    ['DROP TRIGGER IF EXISTS prevent_duplicate_sequence'],
    [`CREATE TRIGGER prevent_duplicate_sequence
      BEFORE INSERT ON show_order
      FOR EACH ROW
      BEGIN
        IF (
          SELECT COUNT(*) FROM show_order
          WHERE show_id = NEW.show_id AND sequence_number = NEW.sequence_number
        ) > 0 THEN
          SET NEW.sequence_number = NULL;
        END IF;
      END`],

    ['DROP TRIGGER IF EXISTS update_collection_status'],
    [`CREATE TRIGGER update_collection_status
      AFTER UPDATE ON fitting
      FOR EACH ROW
      BEGIN
        DECLARE total INT;
        DECLARE finished INT;
        DECLARE col_id INT;
        SELECT collection_id INTO col_id FROM fashion_look WHERE look_id = NEW.look_id;
        SELECT COUNT(*) INTO total
          FROM fitting f JOIN fashion_look l ON f.look_id = l.look_id
          WHERE l.collection_id = col_id;
        SELECT COUNT(*) INTO finished
          FROM fitting f JOIN fashion_look l ON f.look_id = l.look_id
          WHERE l.collection_id = col_id AND f.fitting_status = 'Finished';
        IF total = finished THEN
          UPDATE fit_collection SET collection_status = 'Finished' WHERE collection_id = col_id;
        END IF;
      END`],

    // ── FUNCTIONS ──────────────────────────────────────────────────────────

    ['DROP FUNCTION IF EXISTS count_looks'],
    [`CREATE FUNCTION count_looks(cid INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        DECLARE total INT;
        SELECT COUNT(*) INTO total FROM fashion_look WHERE collection_id = cid;
        RETURN total;
      END`],

    ['DROP FUNCTION IF EXISTS pending_alterations'],
    [`CREATE FUNCTION pending_alterations(iid INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        DECLARE total INT;
        SELECT COUNT(*) INTO total FROM alteration
          WHERE item_id = iid AND alteration_status = 'Pending';
        RETURN total;
      END`],

    ['DROP FUNCTION IF EXISTS is_show_ready'],
    [`CREATE FUNCTION is_show_ready(sid INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        DECLARE coord_count INT;
        DECLARE order_count INT;
        SELECT COUNT(*) INTO coord_count FROM show_event WHERE show_id = sid AND user_id IS NOT NULL;
        SELECT COUNT(*) INTO order_count FROM show_order WHERE show_id = sid;
        IF coord_count > 0 AND order_count > 0 THEN RETURN 1;
        ELSE RETURN 0;
        END IF;
      END`],

    ['DROP FUNCTION IF EXISTS next_sequence'],
    [`CREATE FUNCTION next_sequence(sid INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        DECLARE next_seq INT;
        SELECT MAX(sequence_number) + 1 INTO next_seq FROM show_order WHERE show_id = sid;
        RETURN next_seq;
      END`],
  ];

  for (const [sql] of objects) {
    const label = sql.trim().split('\n')[0].substring(0, 60);
    try {
      await conn.query(sql);
      console.log('OK:', label);
    } catch (err) {
      console.error('FAIL:', label);
      console.error('     ', err.message);
    }
  }

  await conn.end();
  console.log('\nDone.');
}

run().catch(console.error);
