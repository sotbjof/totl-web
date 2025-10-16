#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function revertToGMT() {
  console.log('🔄 Reverting fixture times back to GMT...\n');

  try {
    // Get all fixtures
    const { data: fixtures, error: fetchError } = await supabase
      .from('fixtures')
      .select('id, gw, fixture_index, kickoff_time, home_name, away_name')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!fixtures || fixtures.length === 0) {
      console.log('ℹ️ No fixtures found to fix');
      return;
    }

    console.log(`📋 Found ${fixtures.length} fixtures to check\n`);

    let fixedCount = 0;
    const updates = [];

    for (const fixture of fixtures) {
      if (!fixture.kickoff_time) {
        console.log(`⏭️ Skipping ${fixture.home_name} v ${fixture.away_name} (no kickoff time)`);
        continue;
      }

      const currentTime = fixture.kickoff_time;
      const date = new Date(currentTime);
      
      // Convert back to GMT by subtracting 1 hour (BST to GMT)
      const gmtDate = new Date(date.getTime() - (60 * 60 * 1000)); // Subtract 1 hour
      
      const year = gmtDate.getFullYear();
      const month = String(gmtDate.getMonth() + 1).padStart(2, '0');
      const day = String(gmtDate.getDate()).padStart(2, '0');
      const hours = String(gmtDate.getHours()).padStart(2, '0');
      const minutes = String(gmtDate.getMinutes()).padStart(2, '0');
      
      const gmtTime = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      
      updates.push({
        id: fixture.id,
        kickoff_time: gmtTime,
        home_name: fixture.home_name,
        away_name: fixture.away_name,
        gw: fixture.gw,
        fixture_index: fixture.fixture_index
      });
      
      console.log(`🔄 GW${fixture.gw} ${fixture.home_name} v ${fixture.away_name}: ${currentTime} → ${gmtTime} (GMT)`);
      fixedCount++;
    }

    console.log(`\n📝 Updating ${updates.length} fixtures back to GMT...`);

    // Update fixtures in batches
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('fixtures')
        .update({ kickoff_time: update.kickoff_time })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ Error updating ${update.home_name} v ${update.away_name}:`, updateError.message);
      } else {
        console.log(`✅ Updated GW${update.gw} ${update.home_name} v ${update.away_name} to GMT`);
      }
    }

    console.log(`\n🎉 Reverted ${fixedCount} fixture times back to GMT!`);
    console.log('\n💡 The times should now display correctly as GMT times.');

  } catch (error) {
    console.error('❌ Error reverting fixture times:', error.message);
    process.exit(1);
  }
}

// Run the fix
revertToGMT();
