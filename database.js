const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./downloads.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT,
      duration INTEGER,
      filePath TEXT,
      downloadTime INTEGER,
      downloadCount INTEGER,
      fileSize INTEGER
    )
  `);
});

module.exports = db;
