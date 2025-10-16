// scripts/fix-paul-picks.mjs
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

// Paul's user ID
const paulUserId = 'a6f396b0-e370-4a6f-8ca8-102d1db8ee9d';

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

async function fixPaulPicks() {
  console.log('🔧 Fixing Paul N\'s picks from CSV data...\n');

  try {
    // Step 1: Read the CSV file to get Paul's picks
    console.log('📄 Reading CSV file to get Paul\'s picks...');
    const csvPath = path.join(__dirname, 'GW1.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Find Paul's record (he's listed as "Paul " in the CSV)
    const paulRecord = records.find(record => 
      record['Player Name'].trim() === 'Paul' || 
      record['Player Name'].trim() === 'Paul '
    );

    if (!paulRecord) {
      console.error('❌ Could not find Paul\'s record in CSV');
      return;
    }

    console.log('✅ Found Paul\'s record in CSV');

    // Step 2: Get fixtures to map column names
    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 1)
      .order('fixture_index');
    
    if (fixturesError) throw fixturesError;

    // Step 3: Check if Paul already has picks
    console.log('\n🔍 Checking if Paul already has picks...');
    const { data: existingPicks, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', paulUserId)
      .eq('gw', 1);
    
    if (picksError) throw picksError;

    if (existingPicks.length > 0) {
      console.log(`ℹ️  Paul already has ${existingPicks.length} picks. Deleting them first...`);
      const { error: deleteError } = await supabase
        .from('picks')
        .delete()
        .eq('user_id', paulUserId)
        .eq('gw', 1);
      
      if (deleteError) throw deleteError;
      console.log('✅ Old picks deleted');
    }

    // Step 4: Parse Paul's picks from CSV and insert them
    console.log('\n📝 Adding Paul\'s picks from CSV...');
    
    const picksToInsert = [];
    let correctPredictions = 0;

    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      
      // Get CSV pick (column index starts from 2, so i+2)
      const csvColumnIndex = i + 2;
      const csvPickText = paulRecord[Object.keys(paulRecord)[csvColumnIndex]];
      
      // Convert CSV pick text to H/D/A
      let pick = null;
      if (csvPickText.includes('Win')) {
        if (csvPickText.includes(fixture.home_team)) {
          pick = 'H';
        } else if (csvPickText.includes(fixture.away_team)) {
          pick = 'A';
        }
      } else if (csvPickText === 'Draw') {
        pick = 'D';
      }

      if (pick) {
        picksToInsert.push({
          user_id: paulUserId,
          gw: 1,
          fixture_index: i,
          pick: pick,
        });

        // Check if this pick was correct
        if (pick === actualResults[i]) {
          correctPredictions++;
        }
      }
    }

    // Insert Paul's picks
    const { error: insertError } = await supabase
      .from('picks')
      .insert(picksToInsert);

    if (insertError) throw insertError;

    console.log(`✅ Added ${picksToInsert.length} picks for Paul`);
    console.log(`📊 Paul's score: ${correctPredictions}/${picksToInsert.length} (${Math.round((correctPredictions/picksToInsert.length)*100)}%)`);

    // Step 5: Add Paul's submission
    console.log('\n📝 Adding Paul\'s GW1 submission...');
    
    const { error: submissionError } = await supabase
      .from('gw_submissions')
      .upsert({
        user_id: paulUserId,
        gw: 1,
        submitted_at: new Date().toISOString()
      }, { onConflict: 'user_id,gw' });

    if (submissionError) throw submissionError;
    console.log('✅ Added Paul\'s GW1 submission');

    // Step 6: Show Paul's picks summary
    console.log('\n📋 Paul\'s GW1 Picks Summary:');
    console.log('┌────┬─────────────────────────────────────┬─────────────┬─────────┬──────────┐');
    console.log('│ #  │ Fixture                             │ Paul\'s Pick │ Actual  │ Result   │');
    console.log('├────┼─────────────────────────────────────┼─────────────┼─────────┼──────────┤');

    for (let i = 0; i < picksToInsert.length; i++) {
      const pick = picksToInsert[i];
      const fixture = fixtures[i];
      const actualResult = actualResults[i];
      const isCorrect = pick.pick === actualResult;
      
      const fixtureText = `${fixture.home_team} vs ${fixture.away_team}`;
      const paulPickText = pick.pick === 'H' ? 'Home Win' : pick.pick === 'A' ? 'Away Win' : 'Draw';
      const actualResultText = actualResult === 'H' ? 'Home Win' : actualResult === 'A' ? 'Away Win' : 'Draw';
      const resultIcon = isCorrect ? '✅ CORRECT' : '❌ WRONG';
      
      console.log(`│ ${String(i + 1).padStart(2)} │ ${fixtureText.padEnd(35)} │ ${paulPickText.padEnd(11)} │ ${actualResultText.padEnd(7)} │ ${resultIcon.padEnd(8)} │`);
    }

    console.log('└────┴─────────────────────────────────────┴─────────────┴─────────┴──────────┘');
    console.log(`\n🏆 Paul N's Final Score: ${correctPredictions}/${picksToInsert.length} (${Math.round((correctPredictions/picksToInsert.length)*100)}%)`);

    console.log('\n✅ Paul\'s picks have been successfully added!');

  } catch (error) {
    console.error('❌ Error fixing Paul\'s picks:', error);
  }
}

fixPaulPicks();
