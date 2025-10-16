// scripts/show-carl-picks.mjs
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

async function showCarlPicks() {
  console.log('🎯 Carl\'s GW1 Picks Analysis\n');

  try {
    // Get Carl's user ID
    const carlUserId = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

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

    console.log('📋 Carl\'s GW1 Picks:\n');
    console.log('┌────┬─────────────────────────────────────┬─────────┬─────────┬──────────┐');
    console.log('│ #  │ Fixture                             │ Carl\'s  │ Actual  │ Result   │');
    console.log('│    │                                     │ Pick    │ Result  │          │');
    console.log('├────┼─────────────────────────────────────┼─────────┼─────────┼──────────┤');

    let correctCount = 0;

    carlPicks.forEach((pick, index) => {
      const fixture = gw1Fixtures[index];
      const result = gw1Results[index];
      const isCorrect = pick.pick === result.result;
      
      if (isCorrect) correctCount++;
      
      const fixtureText = `${fixture.home_team} vs ${fixture.away_team}`;
      const carlPickText = pick.pick === 'H' ? 'Home Win' : pick.pick === 'A' ? 'Away Win' : 'Draw';
      const actualResultText = result.result === 'H' ? 'Home Win' : result.result === 'A' ? 'Away Win' : 'Draw';
      const resultIcon = isCorrect ? '✅ CORRECT' : '❌ WRONG';
      
      console.log(`│ ${String(index + 1).padStart(2)} │ ${fixtureText.padEnd(35)} │ ${carlPickText.padEnd(7)} │ ${actualResultText.padEnd(7)} │ ${resultIcon.padEnd(8)} │`);
    });

    console.log('└────┴─────────────────────────────────────┴─────────┴─────────┴──────────┘');
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Picks: ${carlPicks.length}`);
    console.log(`   Correct: ${correctCount}`);
    console.log(`   Wrong: ${carlPicks.length - correctCount}`);
    console.log(`   Score: ${correctCount}/${carlPicks.length}`);
    console.log(`   Success Rate: ${Math.round((correctCount / carlPicks.length) * 100)}%`);

    console.log(`\n🏆 Carl's Score: ${correctCount}`);

  } catch (error) {
    console.error('❌ Error showing Carl\'s picks:', error);
  }
}

showCarlPicks();
