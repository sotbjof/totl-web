// scripts/verify-and-fix-all-picks.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

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

// User mapping (old name to user_id)
const userMapping = {
  'David70': 'david70_user_id', // Placeholder - need real ID
  'william middleton': 'will_middleton_user_id', // Placeholder - need real ID
  'Thomas Bird': 'thomasjamesbird_user_id', // Placeholder - need real ID
  'Jof': '4542c037-5b38-40d0-b189-847b8f17c222', // Real ID from devAuth.ts
  'Carlios': 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl's real ID from devAuth.ts
  'Paul ': 'paul_n_user_id', // Placeholder - need real ID
  'SP': 'sp_user_id', // Placeholder - need real ID
  'Sim': 'sim_user_id', // Placeholder - need real ID
  'Ben': 'ben_new_user_id', // Placeholder - need real ID
  'Matthew Bird': 'matthew_bird_user_id', // Placeholder - need real ID
  'Phil Bolton': 'phil_bolton_user_id', // Placeholder - need real ID
  'Gregory': 'gregory_user_id', // Placeholder - need real ID
};

// Actual results from the screenshot
const actualResults = [
  'H', // Liverpool 4-2 Bournemouth
  'D', // Aston Villa 0-0 Newcastle
  'D', // Brighton 1-1 Fulham
  'H', // Sunderland 3-0 West Ham
  'H', // Tottenham 3-0 Burnley
  'A', // Wolves 0-4 Manchester City
  'D', // Chelsea 0-0 Crystal Palace
  'H', // Nottingham Forest 3-1 Brentford
  'A', // Manchester United 0-1 Arsenal
  'H', // Leeds United 1-0 Everton
];

async function verifyAndFixAllPicks() {
  console.log('🔍 TRIPLE-CHECKING AND FIXING ALL PICKS...\n');

  try {
    // Step 1: Read the original CSV file
    console.log('📄 Reading original CSV file...');
    const csvPath = path.join(__dirname, 'GW1.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`✅ Found ${records.length} player records in CSV`);

    // Step 2: Get current database picks
    console.log('\n📊 Getting current database picks...');
    const { data: currentPicks, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .eq('gw', 1)
      .order('user_id, fixture_index');
    
    if (picksError) throw picksError;
    console.log(`✅ Found ${currentPicks.length} picks in database`);

    // Step 3: Get fixtures to map column names
    console.log('\n🏟️ Getting fixtures...');
    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 1)
      .order('fixture_index');
    
    if (fixturesError) throw fixturesError;
    console.log(`✅ Found ${fixtures.length} fixtures`);

    // Step 4: Parse CSV picks and compare with database
    console.log('\n🔍 Analyzing each player\'s picks...\n');

    const corrections = [];
    let totalCorrectPicks = 0;
    let totalIncorrectPicks = 0;

    for (const record of records) {
      const playerName = record['Player Name'];
      const userId = userMapping[playerName];

      if (!userId) {
        console.log(`⚠️  Skipping unknown player: ${playerName}`);
        continue;
      }

      console.log(`\n👤 ${playerName} (${userId}):`);
      console.log('┌────┬─────────────────────────────────────┬─────────────┬─────────────┬──────────┐');
      console.log('│ #  │ Fixture                             │ CSV Pick    │ DB Pick     │ Status   │');
      console.log('├────┼─────────────────────────────────────┼─────────────┼─────────────┼──────────┤');

      let playerCorrectPicks = 0;
      let playerIncorrectPicks = 0;

      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
        const actualResult = actualResults[i];
        
        // Get CSV pick (column index starts from 2, so i+2)
        const csvColumnIndex = i + 2;
        const csvPickText = record[Object.keys(record)[csvColumnIndex]];
        
        // Convert CSV pick text to H/D/A
        let csvPick = null;
        if (csvPickText.includes('Win')) {
          if (csvPickText.includes(fixture.home_team)) {
            csvPick = 'H';
          } else if (csvPickText.includes(fixture.away_team)) {
            csvPick = 'A';
          }
        } else if (csvPickText === 'Draw') {
          csvPick = 'D';
        }

        // Get database pick
        const dbPick = currentPicks.find(p => 
          p.user_id === userId && p.fixture_index === i
        )?.pick;

        // Check if picks match
        const picksMatch = csvPick === dbPick;
        const status = picksMatch ? '✅ MATCH' : '❌ DIFFERENT';
        
        // Count correct predictions
        if (csvPick === actualResult) {
          playerCorrectPicks++;
          totalCorrectPicks++;
        } else {
          playerIncorrectPicks++;
          totalIncorrectPicks++;
        }

        // Show the comparison
        const fixtureText = `${fixture.home_team} vs ${fixture.away_team}`;
        const csvPickText_display = csvPick === 'H' ? 'Home Win' : csvPick === 'A' ? 'Away Win' : csvPick === 'D' ? 'Draw' : 'Invalid';
        const dbPickText_display = dbPick === 'H' ? 'Home Win' : dbPick === 'A' ? 'Away Win' : dbPick === 'D' ? 'Draw' : 'Missing';
        
        console.log(`│ ${String(i + 1).padStart(2)} │ ${fixtureText.padEnd(35)} │ ${csvPickText_display.padEnd(11)} │ ${dbPickText_display.padEnd(11)} │ ${status.padEnd(8)} │`);

        // Record corrections needed
        if (!picksMatch) {
          corrections.push({
            user_id: userId,
            fixture_index: i,
            old_pick: dbPick,
            new_pick: csvPick,
            player_name: playerName
          });
        }
      }

      console.log('└────┴─────────────────────────────────────┴─────────────┴─────────────┴──────────┘');
      console.log(`📊 ${playerName}: ${playerCorrectPicks}/10 correct (${Math.round((playerCorrectPicks/10)*100)}%)`);
    }

    // Step 5: Show summary of corrections needed
    console.log('\n' + '='.repeat(80));
    console.log('📋 CORRECTIONS NEEDED:');
    console.log('='.repeat(80));
    
    if (corrections.length === 0) {
      console.log('✅ No corrections needed - all picks match CSV!');
    } else {
      console.log(`❌ Found ${corrections.length} picks that need correction:`);
      corrections.forEach(correction => {
        const oldPick = correction.old_pick === 'H' ? 'Home Win' : correction.old_pick === 'A' ? 'Away Win' : correction.old_pick === 'D' ? 'Draw' : 'Missing';
        const newPick = correction.new_pick === 'H' ? 'Home Win' : correction.new_pick === 'A' ? 'Away Win' : correction.new_pick === 'D' ? 'Draw' : 'Invalid';
        console.log(`   ${correction.player_name} - Fixture ${correction.fixture_index + 1}: ${oldPick} → ${newPick}`);
      });
    }

    // Step 6: Apply corrections if any
    if (corrections.length > 0) {
      console.log('\n🔧 Applying corrections...');
      
      for (const correction of corrections) {
        const { error } = await supabase
          .from('picks')
          .update({ pick: correction.new_pick })
          .eq('user_id', correction.user_id)
          .eq('gw', 1)
          .eq('fixture_index', correction.fixture_index);
        
        if (error) {
          console.error(`❌ Error updating ${correction.player_name} fixture ${correction.fixture_index + 1}:`, error);
        } else {
          console.log(`✅ Updated ${correction.player_name} fixture ${correction.fixture_index + 1}`);
        }
      }
      
      console.log('✅ All corrections applied!');
    }

    // Step 7: Final verification
    console.log('\n🔍 Final verification...');
    const { data: finalPicks, error: finalError } = await supabase
      .from('picks')
      .select('*')
      .eq('gw', 1)
      .order('user_id, fixture_index');
    
    if (finalError) throw finalError;

    console.log('\n📊 FINAL SCORES:');
    console.log('='.repeat(80));
    
    const userScores = {};
    
    // Calculate final scores
    for (const pick of finalPicks) {
      if (!userScores[pick.user_id]) {
        userScores[pick.user_id] = { correct: 0, total: 0 };
      }
      userScores[pick.user_id].total++;
      if (pick.pick === actualResults[pick.fixture_index]) {
        userScores[pick.user_id].correct++;
      }
    }

    // Show final scores
    Object.entries(userScores).forEach(([userId, score]) => {
      const playerName = Object.entries(userMapping).find(([name, id]) => id === userId)?.[0] || userId;
      console.log(`${playerName}: ${score.correct}/${score.total} (${Math.round((score.correct/score.total)*100)}%)`);
    });

    console.log('\n✅ TRIPLE-CHECK COMPLETE!');

  } catch (error) {
    console.error('❌ Error in verification:', error);
  }
}

verifyAndFixAllPicks();
