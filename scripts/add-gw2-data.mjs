// scripts/add-gw2-data.mjs
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

// User mapping (CSV name to user_id) - only existing users
const userMapping = {
  'Jof': '4542c037-5b38-40d0-b189-847b8f17c222',
  'Thomas Bird': '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
  'william middleton': '42b48136-040e-42a3-9b0a-dc9550dd1cae', // Will Middleton
  'CarlIos': 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  'Gregory': '8588ee74-34de-4c16-98cb-89078b1ae5ba', // gregory
  'Ben': '8e53f3fb-3842-423c-84d4-192496939632', // Ben New
  'SP': '9c0bcf50-370d-412d-8826-95371a72b4fe',
  'Phil Bolton': 'f09b62e6-792c-4fe1-a6ba-583d802781df',
  'Paul': 'a6f396b0-e370-4a6f-8ca8-102d1db8ee9d', // Paul N
};

// GW2 Fixtures and Results (from the image description)
const gw2Data = [
  {
    fixture_index: 0,
    home_team: 'West Ham United',
    home_code: 'WHU',
    away_team: 'Chelsea',
    away_code: 'CHE',
    kickoff_time: '2025-08-22T20:00:00Z',
    result: 'A' // Chelsea 5-1 West Ham
  },
  {
    fixture_index: 1,
    home_team: 'Manchester City',
    home_code: 'MCI',
    away_team: 'Tottenham Hotspur',
    away_code: 'TOT',
    kickoff_time: '2025-08-23T12:30:00Z',
    result: 'A' // Tottenham 2-0 Manchester City
  },
  {
    fixture_index: 2,
    home_team: 'AFC Bournemouth',
    home_code: 'BOU',
    away_team: 'Wolverhampton Wanderers',
    away_code: 'WOL',
    kickoff_time: '2025-08-23T15:00:00Z',
    result: 'H' // Bournemouth 1-0 Wolves
  },
  {
    fixture_index: 3,
    home_team: 'Brentford',
    home_code: 'BRE',
    away_team: 'Aston Villa',
    away_code: 'AVL',
    kickoff_time: '2025-08-23T15:00:00Z',
    result: 'H' // Brentford 1-0 Aston Villa
  },
  {
    fixture_index: 4,
    home_team: 'Burnley',
    home_code: 'BUR',
    away_team: 'Sunderland',
    away_code: 'SUN',
    kickoff_time: '2025-08-23T15:00:00Z',
    result: 'H' // Burnley 2-0 Sunderland
  },
  {
    fixture_index: 5,
    home_team: 'Arsenal',
    home_code: 'ARS',
    away_team: 'Leeds United',
    away_code: 'LEE',
    kickoff_time: '2025-08-23T17:30:00Z',
    result: 'H' // Arsenal 5-0 Leeds
  },
  {
    fixture_index: 6,
    home_team: 'Crystal Palace',
    home_code: 'CRY',
    away_team: 'Nottingham Forest',
    away_code: 'NFO',
    kickoff_time: '2025-08-24T14:00:00Z',
    result: 'D' // Crystal Palace 1-1 Nottingham Forest
  },
  {
    fixture_index: 7,
    home_team: 'Everton',
    home_code: 'EVE',
    away_team: 'Brighton & Hove Albion',
    away_code: 'BHA',
    kickoff_time: '2025-08-24T14:00:00Z',
    result: 'H' // Everton 2-0 Brighton
  },
  {
    fixture_index: 8,
    home_team: 'Fulham',
    home_code: 'FUL',
    away_team: 'Manchester United',
    away_code: 'MUN',
    kickoff_time: '2025-08-24T16:30:00Z',
    result: 'D' // Fulham 1-1 Manchester United
  },
  {
    fixture_index: 9,
    home_team: 'Newcastle United',
    home_code: 'NEW',
    away_team: 'Liverpool',
    away_code: 'LIV',
    kickoff_time: '2025-08-25T20:00:00Z',
    result: 'A' // Liverpool 3-2 Newcastle
  },
];

async function addGw2Data() {
  console.log('🔍 TRIPLE-CHECKING AND ADDING GW2 DATA...\n');

  try {
    // Step 1: Verify current state
    console.log('📊 Checking current database state...');
    
    const { data: currentMeta, error: metaError } = await supabase
      .from('meta')
      .select('*');
    
    if (metaError) throw metaError;
    console.log(`✅ Current GW: ${currentMeta[0]?.current_gw || 'Unknown'}`);

    // Check if GW2 already exists
    const { data: existingGw2, error: gw2Error } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 2);
    
    if (gw2Error) throw gw2Error;
    
    if (existingGw2.length > 0) {
      console.log(`⚠️  GW2 already has ${existingGw2.length} fixtures. Clearing them first...`);
      
      // Clear existing GW2 data
      await supabase.from('picks').delete().eq('gw', 2);
      await supabase.from('gw_submissions').delete().eq('gw', 2);
      await supabase.from('gw_results').delete().eq('gw', 2);
      await supabase.from('fixtures').delete().eq('gw', 2);
      console.log('✅ Existing GW2 data cleared');
    }

    // Step 2: Add GW2 fixtures
    console.log('\n🏟️ Adding GW2 fixtures...');
    const fixtureRows = gw2Data.map(f => ({
      gw: 2,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      home_code: f.home_code,
      away_team: f.away_team,
      away_code: f.away_code,
      kickoff_time: f.kickoff_time,
    }));

    const { error: fixtureError } = await supabase
      .from('fixtures')
      .insert(fixtureRows);
    
    if (fixtureError) throw fixtureError;
    console.log(`✅ Added ${fixtureRows.length} GW2 fixtures`);

    // Step 3: Add GW2 results
    console.log('\n🏆 Adding GW2 results...');
    const resultRows = gw2Data.map(f => ({
      gw: 2,
      fixture_index: f.fixture_index,
      result: f.result,
      decided_at: new Date().toISOString(),
    }));

    const { error: resultError } = await supabase
      .from('gw_results')
      .insert(resultRows);
    
    if (resultError) throw resultError;
    console.log(`✅ Added ${resultRows.length} GW2 results`);

    // Step 4: Read CSV and add user picks
    console.log('\n📄 Reading GW2 CSV file...');
    const csvPath = path.join(__dirname, 'GW2.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`✅ Found ${records.length} player records in CSV`);

    // Step 5: Process each user's picks
    console.log('\n👥 Processing user picks...');
    const allPicks = [];
    const submissions = [];

    for (const record of records) {
      const playerName = record['Who are you?'] || record['Player Name'];
      const userId = userMapping[playerName];

      if (!userId) {
        console.log(`⚠️  Skipping unknown player: ${playerName}`);
        continue;
      }

      console.log(`\n👤 Processing ${playerName} (${userId}):`);
      
      const userPicks = [];
      let correctPredictions = 0;

      for (let i = 0; i < gw2Data.length; i++) {
        const fixture = gw2Data[i];
        
        // Get CSV pick (column index starts from 2, so i+2)
        const csvColumnIndex = i + 2;
        const csvPickText = record[Object.keys(record)[csvColumnIndex]];
        
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
          userPicks.push({
            user_id: userId,
            gw: 2,
            fixture_index: i,
            pick: pick,
          });

          // Check if this pick was correct
          if (pick === fixture.result) {
            correctPredictions++;
          }

          const pickText = pick === 'H' ? 'Home Win' : pick === 'A' ? 'Away Win' : 'Draw';
          const actualResult = fixture.result === 'H' ? 'Home Win' : fixture.result === 'A' ? 'Away Win' : 'Draw';
          const isCorrect = pick === fixture.result;
          
          console.log(`   ${i + 1}. ${fixture.home_team} vs ${fixture.away_team}: ${pickText} ${isCorrect ? '✅' : '❌'} (Actual: ${actualResult})`);
        }
      }

      allPicks.push(...userPicks);
      submissions.push({
        user_id: userId,
        gw: 2,
        submitted_at: new Date().toISOString()
      });

      console.log(`   📊 ${playerName}: ${correctPredictions}/${userPicks.length} correct (${Math.round((correctPredictions/userPicks.length)*100)}%)`);
    }

    // Step 6: Insert all picks
    console.log(`\n📝 Inserting ${allPicks.length} picks...`);
    const { error: picksError } = await supabase
      .from('picks')
      .insert(allPicks);
    
    if (picksError) throw picksError;
    console.log('✅ All picks inserted');

    // Step 7: Insert submissions
    console.log(`\n📋 Inserting ${submissions.length} submissions...`);
    const { error: submissionsError } = await supabase
      .from('gw_submissions')
      .insert(submissions);
    
    if (submissionsError) throw submissionsError;
    console.log('✅ All submissions inserted');

    // Step 8: Update meta table to current_gw = 2
    console.log('\n⚙️ Updating meta table...');
    const { error: metaUpdateError } = await supabase
      .from('meta')
      .upsert({ id: 1, current_gw: 2 });
    
    if (metaUpdateError) throw metaUpdateError;
    console.log('✅ Meta table updated to current_gw = 2');

    // Step 9: Final verification
    console.log('\n🔍 FINAL VERIFICATION...');
    
    // Check fixtures
    const { data: finalFixtures, error: finalFixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 2);
    
    if (finalFixturesError) throw finalFixturesError;
    console.log(`✅ GW2 fixtures: ${finalFixtures.length}`);

    // Check results
    const { data: finalResults, error: finalResultsError } = await supabase
      .from('gw_results')
      .select('*')
      .eq('gw', 2);
    
    if (finalResultsError) throw finalResultsError;
    console.log(`✅ GW2 results: ${finalResults.length}`);

    // Check picks
    const { data: finalPicks, error: finalPicksError } = await supabase
      .from('picks')
      .select('*')
      .eq('gw', 2);
    
    if (finalPicksError) throw finalPicksError;
    console.log(`✅ GW2 picks: ${finalPicks.length}`);

    // Check submissions
    const { data: finalSubmissions, error: finalSubmissionsError } = await supabase
      .from('gw_submissions')
      .select('*')
      .eq('gw', 2);
    
    if (finalSubmissionsError) throw finalSubmissionsError;
    console.log(`✅ GW2 submissions: ${finalSubmissions.length}`);

    // Check meta
    const { data: finalMeta, error: finalMetaError } = await supabase
      .from('meta')
      .select('*');
    
    if (finalMetaError) throw finalMetaError;
    console.log(`✅ Current GW: ${finalMeta[0]?.current_gw}`);

    console.log('\n🎉 GW2 DATA SUCCESSFULLY ADDED!');
    console.log('📊 Summary:');
    console.log(`   - ${finalFixtures.length} fixtures`);
    console.log(`   - ${finalResults.length} results`);
    console.log(`   - ${finalPicks.length} picks`);
    console.log(`   - ${finalSubmissions.length} submissions`);
    console.log(`   - Current GW: ${finalMeta[0]?.current_gw}`);

  } catch (error) {
    console.error('❌ Error adding GW2 data:', error);
  }
}

addGw2Data();
