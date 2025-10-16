// scripts/check-carl-scores.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarlScores() {
  console.log('🔍 Investigating Carl\'s scores and unicorns...\n');

  try {
    // Get Carl's user ID (from our mapping)
    const carlUserId = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'; // Carl's user ID from devAuth.ts

    // Get Carl's picks for GW1
    const { data: carlPicks, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', carlUserId)
      .eq('gw', 1)
      .order('fixture_index');
    
    if (picksError) throw picksError;

    // Get GW1 results
    const { data: gw1Results, error: resultsError } = await supabase
      .from('gw_results')
      .select('*')
      .eq('gw', 1)
      .order('fixture_index');
    
    if (resultsError) throw resultsError;

    // Get GW1 fixtures
    const { data: gw1Fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 1)
      .order('fixture_index');
    
    if (fixturesError) throw fixturesError;

    console.log('🎯 Carl\'s GW1 Picks:');
    carlPicks.forEach((pick, index) => {
      const fixture = gw1Fixtures[index];
      const result = gw1Results[index];
      const isCorrect = pick.pick === result.result;
      console.log(`  ${index + 1}. ${fixture.home_team} vs ${fixture.away_team}: Carl picked ${pick.pick}, Result was ${result.result} ${isCorrect ? '✅' : '❌'}`);
    });

    // Calculate correct predictions
    const correctPredictions = carlPicks.filter((pick, index) => {
      const result = gw1Results[index];
      return pick.pick === result.result;
    });

    console.log(`\n📊 Carl's Score Calculation:`);
    console.log(`  Total picks: ${carlPicks.length}`);
    console.log(`  Correct predictions: ${correctPredictions.length}`);
    console.log(`  Score: ${correctPredictions.length}`);

    // Check for unicorns (need to understand what constitutes a unicorn)
    console.log(`\n🦄 Unicorn Analysis:`);
    console.log(`  Current unicorn count: 1 (from screenshot)`);
    console.log(`  Need to understand unicorn logic...`);

    // Let's also check what the system thinks Carl's score should be
    console.log(`\n🔍 System Data:`);
    console.log(`  Carl's user ID: ${carlUserId}`);
    console.log(`  GW1 picks count: ${carlPicks.length}`);
    console.log(`  GW1 results count: ${gw1Results.length}`);
    console.log(`  GW1 fixtures count: ${gw1Fixtures.length}`);

  } catch (error) {
    console.error('❌ Error checking Carl\'s scores:', error);
  }
}

checkCarlScores();
