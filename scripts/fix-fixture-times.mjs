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

async function fixFixtureTimes() {
  console.log('🔧 Fixing fixture times...\n');

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
      
      // Check if the time has a 'Z' suffix (UTC) or if it's causing timezone issues
      if (currentTime.includes('Z') || currentTime.includes('+') || currentTime.includes('-')) {
        // Extract just the date and time parts without timezone
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        const newTime = `${year}-${month}-${day}T${hours}:${minutes}:00`;
        
        updates.push({
          id: fixture.id,
          kickoff_time: newTime,
          home_name: fixture.home_name,
          away_name: fixture.away_name,
          gw: fixture.gw,
          fixture_index: fixture.fixture_index
        });
        
        console.log(`🔄 GW${fixture.gw} ${fixture.home_name} v ${fixture.away_name}: ${currentTime} → ${newTime}`);
        fixedCount++;
      } else {
        console.log(`✅ GW${fixture.gw} ${fixture.home_name} v ${fixture.away_name}: ${currentTime} (already correct)`);
      }
    }

    if (updates.length === 0) {
      console.log('\n✅ All fixture times are already in the correct format!');
      return;
    }

    console.log(`\n📝 Updating ${updates.length} fixtures...`);

    // Update fixtures in batches
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('fixtures')
        .update({ kickoff_time: update.kickoff_time })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ Error updating ${update.home_name} v ${update.away_name}:`, updateError.message);
      } else {
        console.log(`✅ Updated GW${update.gw} ${update.home_name} v ${update.away_name}`);
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} fixture times!`);
    console.log('\n💡 The times should now display correctly in the admin interface.');

  } catch (error) {
    console.error('❌ Error fixing fixture times:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixFixtureTimes();
