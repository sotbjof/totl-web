// scripts/check-unicorn-logic.mjs
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

async function checkUnicornLogic() {
  console.log('🦄 Investigating unicorn logic for all players...\n');

  try {
    // Get all picks for GW1
    const { data: allPicks, error: picksError } = await supabase
      .from('picks')
      .select('*')
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

    // Get all unique user IDs to count total players
    const uniqueUserIds = [...new Set(allPicks.map(p => p.user_id))];
    const totalPlayers = uniqueUserIds.length;
    
    console.log(`👥 Total players in GW1: ${totalPlayers}`);
    console.log(`📊 Unicorn requirement: 3+ players (${totalPlayers >= 3 ? '✅ Met' : '❌ Not met'})`);

    if (totalPlayers < 3) {
      console.log('❌ No unicorns possible - need 3+ players for unicorns');
      return;
    }

    console.log('\n🔍 Analyzing each fixture for unicorns:');
    console.log('=' * 80);

    let carlUnicorns = 0;

    // Check each fixture
    for (let i = 0; i < gw1Fixtures.length; i++) {
      const fixture = gw1Fixtures[i];
      const result = gw1Results[i];
      const fixturePicks = allPicks.filter(p => p.fixture_index === i);
      
      // Find who got this fixture correct
      const correctPicks = fixturePicks.filter(p => p.pick === result.result);
      const correctUsers = correctPicks.map(p => p.user_id);
      
      console.log(`\n${i + 1}. ${fixture.home_team} vs ${fixture.away_team}`);
      console.log(`   Result: ${result.result}`);
      console.log(`   Correct picks: ${correctUsers.length}/${fixturePicks.length}`);
      
      if (correctUsers.length === 1) {
        // This is a unicorn!
        const unicornUserId = correctUsers[0];
        console.log(`   🦄 UNICORN! User ${unicornUserId} was the only one correct`);
        
        if (unicornUserId === 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2') {
          carlUnicorns++;
          console.log(`   🎯 This is Carl's unicorn!`);
        }
      } else if (correctUsers.length === 0) {
        console.log(`   ❌ Nobody got this correct`);
      } else {
        console.log(`   👥 Multiple people got this correct`);
      }

      // Show all picks for this fixture
      fixturePicks.forEach(pick => {
        const isCorrect = pick.pick === result.result;
        const isCarl = pick.user_id === 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
        console.log(`     User ${pick.user_id}${isCarl ? ' (Carl)' : ''}: ${pick.pick} ${isCorrect ? '✅' : '❌'}`);
      });
    }

    console.log('\n' + '=' * 80);
    console.log(`🦄 Carl's total unicorns: ${carlUnicorns}`);
    console.log(`📊 Expected unicorns from screenshot: 1`);
    console.log(`${carlUnicorns === 1 ? '✅' : '❌'} Unicorn count ${carlUnicorns === 1 ? 'matches' : 'does not match'} screenshot`);

  } catch (error) {
    console.error('❌ Error checking unicorn logic:', error);
  }
}

checkUnicornLogic();
