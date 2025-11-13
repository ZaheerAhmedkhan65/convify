const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "convify.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT,
      converted_name TEXT,
      format TEXT,
      file_path TEXT,
      size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resize_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT,
      resized_name TEXT,
      width TEXT,
      height TEXT,
      crop TEXT,
      file_path TEXT,
      size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
