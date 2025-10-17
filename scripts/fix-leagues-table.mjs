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

async function fixLeaguesTable() {
  console.log('🔧 Fixing leagues table...');
  
  try {
    // Step 1: Check if start_gw column exists
    console.log('1. Checking if start_gw column exists...');
    const { error: testError } = await supabase
      .from('leagues')
      .select('start_gw')
      .limit(1);

    if (!testError) {
      console.log('✅ start_gw column already exists');
      
      // Check if existing leagues have start_gw set
      const { data: leagues, error: checkError } = await supabase
        .from('leagues')
        .select('id, start_gw')
        .is('start_gw', null)
        .limit(1);
      
      if (checkError) {
        console.log('Error checking existing leagues:', checkError.message);
      } else if (leagues && leagues.length > 0) {
        console.log('2. Updating existing leagues to start from GW1...');
        const { error: updateError } = await supabase
          .from('leagues')
          .update({ start_gw: 1 })
          .is('start_gw', null);
        
        if (updateError) {
          console.log('❌ Error updating leagues:', updateError.message);
        } else {
          console.log('✅ Updated existing leagues');
        }
      } else {
        console.log('✅ All leagues already have start_gw set');
      }
      
      console.log('🎉 Database is ready!');
      return;
    }

    // Step 2: Add the column using RPC
    console.log('2. Adding start_gw column...');
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE leagues ADD COLUMN start_gw INTEGER DEFAULT 1;'
    });

    if (addColumnError) {
      console.log('❌ Could not add column via RPC:', addColumnError.message);
      console.log('This might be due to RLS policies or permissions.');
      console.log('\nManual steps required:');
      console.log('1. Go to Supabase dashboard → SQL Editor');
      console.log('2. Run: ALTER TABLE leagues ADD COLUMN start_gw INTEGER DEFAULT 1;');
      console.log('3. Run: UPDATE leagues SET start_gw = 1 WHERE start_gw IS NULL;');
      return;
    }

    console.log('✅ Successfully added start_gw column');

    // Step 3: Update existing leagues
    console.log('3. Updating existing leagues to start from GW1...');
    const { error: updateError } = await supabase
      .from('leagues')
      .update({ start_gw: 1 })
      .is('start_gw', null);

    if (updateError) {
      console.log('❌ Error updating leagues:', updateError.message);
    } else {
      console.log('✅ Updated existing leagues');
    }

    // Step 4: Verify
    console.log('4. Verifying the fix...');
    const { data: testLeagues, error: verifyError } = await supabase
      .from('leagues')
      .select('id, name, code, start_gw')
      .limit(3);

    if (verifyError) {
      console.log('❌ Error verifying:', verifyError.message);
    } else {
      console.log('✅ Verification successful!');
      console.log('Sample leagues:', testLeagues);
    }

    console.log('🎉 Database migration completed successfully!');
    console.log('Mini leagues will now start fresh from their creation gameweek.');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\nManual fix required:');
    console.log('1. Go to Supabase dashboard → SQL Editor');
    console.log('2. Run: ALTER TABLE leagues ADD COLUMN start_gw INTEGER DEFAULT 1;');
    console.log('3. Run: UPDATE leagues SET start_gw = 1 WHERE start_gw IS NULL;');
  }
}

fixLeaguesTable();
