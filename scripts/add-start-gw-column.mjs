#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addStartGwColumn() {
  console.log('Adding start_gw column to leagues table...');
  
  try {
    // First, check if the column already exists
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'leagues' });
    
    if (columnsError) {
      console.log('Could not check existing columns, proceeding with add...');
    } else if (columns && columns.some(col => col.column_name === 'start_gw')) {
      console.log('✅ start_gw column already exists');
      return;
    }

    // Add the start_gw column
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE leagues ADD COLUMN start_gw INTEGER DEFAULT 1;'
    });

    if (error) {
      console.error('❌ Error adding start_gw column:', error.message);
      
      // Try alternative approach using direct SQL
      console.log('Trying alternative approach...');
      const { error: altError } = await supabase
        .from('leagues')
        .select('id')
        .limit(1);
      
      if (altError && altError.message.includes('start_gw')) {
        console.log('Column does not exist, but we cannot add it via RPC.');
        console.log('Please add the column manually in Supabase dashboard:');
        console.log('ALTER TABLE leagues ADD COLUMN start_gw INTEGER DEFAULT 1;');
        return;
      }
    } else {
      console.log('✅ Successfully added start_gw column to leagues table');
    }

    // Update existing leagues to have start_gw = 1 (so they start from GW1)
    console.log('Updating existing leagues to start from GW1...');
    const { error: updateError } = await supabase
      .from('leagues')
      .update({ start_gw: 1 })
      .is('start_gw', null);

    if (updateError) {
      console.log('Note: Could not update existing leagues:', updateError.message);
    } else {
      console.log('✅ Updated existing leagues to start from GW1');
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

addStartGwColumn();
