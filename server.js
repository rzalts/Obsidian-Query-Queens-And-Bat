require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory always exists (Render ephemeral filesystem)
fs.mkdirSync(path.join(__dirname, 'public/uploads'), { recursive: true });

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'obsidian_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 },
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.get('/', (req, res) => res.redirect('/main'));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/shows'));
app.use('/', require('./routes/collections'));
app.use('/', require('./routes/alterations'));
app.use('/', require('./routes/showorder'));
app.use('/', require('./routes/looks'));
app.use('/', require('./routes/models'));
app.use('/', require('./routes/items'));
app.use('/', require('./routes/fittings'));
app.use('/', require('./routes/locations'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OBSIDIAN running on http://localhost:${PORT}`));
