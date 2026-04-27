require('dotenv').config();
const db = require('./db');

async function setup() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS show_coordinator (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(50),
      last_name VARCHAR(50),
      email VARCHAR(100) UNIQUE,
      phone_number VARCHAR(20),
      reg_password VARCHAR(255),
      reg_role VARCHAR(50)
    )`,
    `CREATE TABLE IF NOT EXISTS fit_collection (
      collection_id INT AUTO_INCREMENT PRIMARY KEY,
      collection_name VARCHAR(50),
      brand VARCHAR(50),
      season VARCHAR(20),
      collection_year INT,
      collection_status VARCHAR(20)
    )`,
    `CREATE TABLE IF NOT EXISTS model (
      model_id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(50),
      last_name VARCHAR(50),
      agency VARCHAR(50),
      email VARCHAR(100),
      phone_number VARCHAR(20)
    )`,
    `CREATE TABLE IF NOT EXISTS fashion_look (
      look_id INT AUTO_INCREMENT PRIMARY KEY,
      collection_id INT,
      model_id INT,
      look_category VARCHAR(50),
      look_description VARCHAR(255),
      FOREIGN KEY (collection_id) REFERENCES fit_collection(collection_id),
      FOREIGN KEY (model_id) REFERENCES model(model_id)
    )`,
    `CREATE TABLE IF NOT EXISTS fitting (
      fitting_id INT AUTO_INCREMENT PRIMARY KEY,
      look_id INT,
      fitting_date DATE,
      fitting_status VARCHAR(20),
      FOREIGN KEY (look_id) REFERENCES fashion_look(look_id)
    )`,
    `CREATE TABLE IF NOT EXISTS fit_location (
      location_id INT AUTO_INCREMENT PRIMARY KEY,
      location_name VARCHAR(50),
      location_address VARCHAR(100)
    )`,
    `CREATE TABLE IF NOT EXISTS item (
      item_id INT AUTO_INCREMENT PRIMARY KEY,
      collection_id INT,
      location_id INT,
      item_category VARCHAR(50),
      item_size INT,
      item_description VARCHAR(255),
      item_version INT,
      item_condition VARCHAR(20),
      FOREIGN KEY (collection_id) REFERENCES fit_collection(collection_id),
      FOREIGN KEY (location_id) REFERENCES fit_location(location_id)
    )`,
    `CREATE TABLE IF NOT EXISTS alteration (
      alteration_id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT,
      fitting_id INT,
      alteration_type VARCHAR(50),
      date_needed_by DATE,
      alteration_status VARCHAR(20),
      FOREIGN KEY (item_id) REFERENCES item(item_id),
      FOREIGN KEY (fitting_id) REFERENCES fitting(fitting_id)
    )`,
    `CREATE TABLE IF NOT EXISTS show_event (
      show_id INT AUTO_INCREMENT PRIMARY KEY,
      collection_id INT,
      user_id INT,
      show_name VARCHAR(50),
      show_date DATE,
      venue VARCHAR(50),
      start_time TIME,
      end_time TIME,
      show_address VARCHAR(100),
      logo_path VARCHAR(255),
      FOREIGN KEY (collection_id) REFERENCES fit_collection(collection_id),
      FOREIGN KEY (user_id) REFERENCES show_coordinator(user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS show_order (
      show_order_id INT AUTO_INCREMENT PRIMARY KEY,
      show_id INT,
      look_id INT,
      sequence_number INT,
      FOREIGN KEY (show_id) REFERENCES show_event(show_id),
      FOREIGN KEY (look_id) REFERENCES fashion_look(look_id),
      UNIQUE (show_id, look_id),
      UNIQUE (show_id, sequence_number)
    )`,
    `CREATE TABLE IF NOT EXISTS look_item (
      item_id INT,
      look_id INT,
      PRIMARY KEY (item_id, look_id),
      FOREIGN KEY (item_id) REFERENCES item(item_id),
      FOREIGN KEY (look_id) REFERENCES fashion_look(look_id)
    )`,
  ];

  for (const q of queries) {
    await db.query(q);
    const name = q.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    console.log(`✓ ${name}`);
  }

  // Seed sample data (skip if already populated)
  const [[{ cnt }]] = await db.query('SELECT COUNT(*) as cnt FROM show_coordinator');
  if (cnt > 0) { console.log('Data already seeded, skipping.'); process.exit(); }

  await db.query(`INSERT INTO fit_collection (collection_name, brand, season, collection_year, collection_status) VALUES
    ('Plato''s Atlantis','Gucci','Spring',2021,'Finished'),
    ('Supermarket','Chanel','Summer',2022,'Finished'),
    ('Sunny Beach','Balenciaga','Summer',2021,'Finished'),
    ('School Life','Louis Vuitton','Winter',2026,'Not Finished'),
    ('Rainy Day','Miu Miu','Fall',2019,'Finished'),
    ('The Red Carpet','Saint Laurent','Spring',2017,'Finished'),
    ('The Airport','Chanel','Summer',2025,'Finished'),
    ('The Park','Gucci','Fall',2026,'Not Finished'),
    ('Picnic Day','Marc Jacobs','Spring',2021,'Finished'),
    ('Historic Museum','Louis Vuitton','Fall',2026,'Not Finished'),
    ('Red','Balenciaga','Winter',2018,'Finished')`);
  console.log('✓ seeded fit_collection');

  await db.query(`INSERT INTO model (first_name, last_name, agency, email, phone_number) VALUES
    ('Spongebob','Squarepants','Bikini Bottom','spongebobs@gmail.com','132-456-7891'),
    ('Patrick','Star','Bikini Bottom','patricks@gmail.com','132-456-7892'),
    ('Garold','Wilson Jr.','Bikini Bottom','garoldw@gmail.com','132-456-7893'),
    ('Sheldon','Plankton','Binkini Bottom','sheldonp@gmail.com','132-456-7894'),
    ('Shinnosuke','Nohara','Nohara Family','shinnosuken@gmail.com','132-456-7895'),
    ('Himawari','Nohara','Nohara Family','himawarin@gmail.com','132-456-7896'),
    ('Shiro','Nohara','Nohara Family','shiron@gmail.com','132-456-7897'),
    ('Garfield','Cat','Lasagna Lovers','garfieldc@gmail.com','132-456-7898'),
    ('Odie','Dog','Lasagna Lovers','odied@gmail.com','132-456-7899'),
    ('Leonardo','Turtle','Turtle Gang','leonardot@gmail.com','132-456-7810'),
    ('Michelangelo','Turtle','Turtle Gang','michelangelot@gmail.com','132-456-7811'),
    ('Donatello','Turtle','Turtle Gang','donatellot@gmail.com','132-456-7812'),
    ('Raphael','Turtle','Turtle Gang','raphaelt@gmail.com','132-456-7813'),
    ('Thomas Jasper','Cat','The Cat and The Mouse','tomj@gmail.com','132-456-7814'),
    ('Gerald Jinx','Mouse','The Cat and The Mouse','jerrym@gmail.com','132-456-7815')`);
  console.log('✓ seeded model');

  await db.query(`INSERT INTO fashion_look (collection_id, model_id, look_category, look_description) VALUES
    (1,1,'Evening Wear','Flowing aqua gown inspired by Atlantis with pearl detailing'),
    (2,2,'Street Luxe','Layered supermarket-inspired luxury outfit with gold accents'),
    (3,3,'Swimwear','Bright beach set with lightweight fabric and sun-themed patterns'),
    (4,4,'Uniform','Structured school-inspired outfit with blazer and pleated layers'),
    (5,5,'Outerwear','Reflective rainy-day trench coat with transparent paneling'),
    (6,6,'Formal Wear','Elegant red carpet gown with velvet finish and dramatic silhouette'),
    (7,7,'Travel Wear','Polished airport look with tailored layers and relaxed fit'),
    (8,8,'Casual Wear','Relaxed park-ready outfit with earthy green tones'),
    (9,9,'Daywear','Soft floral picnic dress with light fabric and pastel trim'),
    (10,10,'Historic Wear','Vintage-inspired museum look with classic tailoring and textured fabric'),
    (11,11,'Formal Wear','Bold monochrome red suit with sharp structured lines')`);
  console.log('✓ seeded fashion_look');

  await db.query(`INSERT INTO fitting (look_id, fitting_date, fitting_status) VALUES
    (1,'2024-02-24','Finished'),(2,'2026-03-14','Not Finished'),(3,'2023-10-29','Finished'),
    (4,'2023-09-14','Finished'),(5,'2024-08-17','Finished'),(6,'2026-12-15','Not Finished'),
    (7,'2026-04-19','Not Finished'),(8,'2019-08-21','Finished'),(9,'2020-04-27','Finished'),
    (10,'2026-05-16','Not Finished'),(11,'2023-07-31','Finished')`);
  console.log('✓ seeded fitting');

  await db.query(`INSERT INTO fit_location (location_name, location_address) VALUES
    ('Main Runway Hall','123 Fashion Ave, NYC'),('Backstage Prep Room A','123 Fashion Ave, NYC'),
    ('Backstage Prep Room B','123 Fashion Ave, NYC'),('Wardrobe Storage 1','500 Garment District, NYC'),
    ('Wardrobe Storage 2','500 Garment District, NYC'),('Fitting Studio East','22 Model St, NYC'),
    ('Fitting Studio West','22 Model St, NYC'),('VIP Dressing Lounge','88 Luxury Blvd, NYC'),
    ('Outdoor Runway Park','Central Park Stage, NYC'),('Photography Studio','45 Media Ave, NYC'),
    ('Makeup & Styling Room','77 Beauty St, NYC')`);
  console.log('✓ seeded fit_location');

  await db.query(`INSERT INTO item (collection_id, location_id, item_category, item_size, item_description, item_version, item_condition) VALUES
    (1,4,'Dress',4,'Ocean-inspired silk gown',1,'New'),(2,5,'Jacket',3,'Luxury tweed jacket',1,'New'),
    (3,4,'Swimwear',2,'Beachwear set',1,'Good'),(4,2,'Uniform',5,'School blazer outfit',1,'New'),
    (5,3,'Raincoat',4,'Transparent raincoat',2,'Used'),(6,1,'Evening Wear',3,'Red carpet gown',1,'New'),
    (7,2,'Travel Outfit',4,'Airport chic outfit',1,'New'),(8,6,'Casual',3,'Park casual wear',2,'Good'),
    (9,7,'Picnic Dress',2,'Light summer dress',1,'New'),(10,10,'Historic Wear',4,'Museum vintage outfit',1,'New'),
    (11,11,'Formal',5,'Elegant red suit',1,'New')`);
  console.log('✓ seeded item');

  await db.query(`INSERT INTO alteration (item_id, fitting_id, alteration_type, date_needed_by, alteration_status) VALUES
    (1,1,'Hem Adjustment','2026-03-10','Completed'),(2,2,'Sleeve Tightening','2026-03-20','Pending'),
    (3,3,'Strap Fix','2026-02-15','Completed'),(4,4,'Waist Adjustment','2026-01-10','Completed'),
    (5,5,'Length Shortening','2026-02-05','Completed'),(6,6,'Zipper Replacement','2026-04-01','Pending'),
    (7,7,'Button Replacement','2026-04-10','Pending'),(8,8,'Fabric Repair','2025-08-01','Completed'),
    (9,9,'Fit Adjustment','2025-09-15','Completed'),(10,10,'Collar Fix','2026-05-01','Pending'),
    (11,11,'Tapering','2026-01-30','Completed')`);
  console.log('✓ seeded alteration');

  await db.query(`INSERT INTO look_item (item_id, look_id) VALUES
    (1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9),(10,10),(11,11)`);
  console.log('✓ seeded look_item');

  console.log('\nAll done! Run: npm start');
  process.exit();
}

setup().catch(e => { console.error(e.message); process.exit(1); });
