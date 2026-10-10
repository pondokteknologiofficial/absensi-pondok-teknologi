const path = require('path');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || '';

module.exports = {
  PORT: process.env.PORT || 3000,
  TIMEZONE: 'Asia/Jakarta',
  DB_DIR: path.join(__dirname, '..', 'data'),
  DB_FILE: path.join(__dirname, '..', 'data', 'absensi.db'),
  DEFAULT_AUTO_RESET_SECONDS: 4,
  DATABASE_URL: databaseUrl,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  DB_TYPE: databaseUrl ? 'postgres' : 'sqlite'
};

