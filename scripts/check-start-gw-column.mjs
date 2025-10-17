#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addStartGwColumn() {
  console.log('Adding start_gw column to leagues table...');
  
  try {
    // Test if column exists by trying to select it
    const { error: testError } = await supabase
      .from('leagues')
      .select('start_gw')
      .limit(1);

    if (!testError) {
      console.log('✅ start_gw column already exists');
      return;
    }

    console.log('Column does not exist. Please add it manually:');
    console.log('1. Go to Supabase dashboard → SQL Editor');
    console.log('2. Run: ALTER TABLE leagues ADD COLUMN start_gw INTEGER DEFAULT 1;');
    console.log('3. Run: UPDATE leagues SET start_gw = 1 WHERE start_gw IS NULL;');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addStartGwColumn();
