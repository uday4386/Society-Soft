const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(opts) {
    const userDataPath = app.getPath('userData');
    const oldJsonPath = path.join(userDataPath, opts.configName + '.json');
    this.dbPath = path.join(userDataPath, 'database.sqlite');
    
    this.defaults = opts.defaults || { candidates: {}, globalSettings: {} };
    
    // Initialize DB
    this.db = new sqlite3.Database(this.dbPath);
    this._initSchema();
    this._migrateIfNeeded(oldJsonPath);
  }

  _initSchema() {
    this.db.serialize(() => {
      this.db.run('CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, data TEXT)');
      this.db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    });
  }

  _migrateIfNeeded(oldJsonPath) {
    if (fs.existsSync(oldJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(oldJsonPath, 'utf-8'));
        
        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION');
          
          if (data.candidates) {
            const stmt = this.db.prepare('INSERT OR IGNORE INTO candidates (id, data) VALUES (?, ?)');
            for (const id in data.candidates) {
              stmt.run(id, JSON.stringify(data.candidates[id]));
            }
            stmt.finalize();
          }
          
          if (data.globalSettings) {
            const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
            stmt.run('globalSettings', JSON.stringify(data.globalSettings));
            stmt.finalize();
          }
          
          this.db.run('COMMIT', (err) => {
            if (!err) {
              // Rename old file so it won't be migrated again
              fs.renameSync(oldJsonPath, oldJsonPath + '.bak');
            }
          });
        });
      } catch (e) {
        console.error("Migration failed", e);
      }
    }
  }

  // --- API for Settings ---
  getSettings() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT value FROM settings WHERE key = ?', ['globalSettings'], (err, row) => {
        if (err) return reject(err);
        if (row) {
          resolve(JSON.parse(row.value));
        } else {
          resolve(this.defaults.globalSettings);
        }
      });
    });
  }

  saveSettings(settings) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['globalSettings', JSON.stringify(settings)], function(err) {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  // --- API for Candidates ---
  getCandidates() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM candidates', (err, rows) => {
        if (err) return reject(err);
        const candidates = {};
        rows.forEach(row => {
          candidates[row.id] = JSON.parse(row.data);
        });
        resolve(candidates);
      });
    });
  }

  saveCandidate(candidate) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT OR REPLACE INTO candidates (id, data) VALUES (?, ?)', [candidate.id, JSON.stringify(candidate)], function(err) {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  deleteCandidate(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM candidates WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  clearDatabase() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM candidates');
        this.db.run('DELETE FROM settings', (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
    });
  }
}

module.exports = Store;
