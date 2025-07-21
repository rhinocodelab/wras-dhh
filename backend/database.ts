import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = 'wras_dhh.db';
const db = new sqlite3.Database(dbPath);

// Custom promisified database methods
const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

export { db, dbRun, dbGet, dbAll };

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create stations table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_name TEXT NOT NULL,
        station_code TEXT UNIQUE NOT NULL,
        station_name_hi TEXT,
        station_name_mr TEXT,
        station_name_gu TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create train_routes table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS train_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        train_number TEXT UNIQUE NOT NULL,
        train_name TEXT NOT NULL,
        train_name_hi TEXT,
        train_name_mr TEXT,
        train_name_gu TEXT,
        start_station_id INTEGER NOT NULL,
        end_station_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (start_station_id) REFERENCES stations (id),
        FOREIGN KEY (end_station_id) REFERENCES stations (id)
      )
    `);

    // Check if default admin user exists
    const existingAdmin = await dbGet('SELECT * FROM users WHERE username = ?', ['administrator']);
    
    if (!existingAdmin) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin@123', 10);
      await dbRun(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['administrator', hashedPassword, 'admin']
      );
      console.log('Default administrator user created');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}