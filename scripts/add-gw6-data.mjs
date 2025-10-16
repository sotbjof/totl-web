// scripts/add-gw6-data.mjs
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

// GW6 Fixtures and Results (from the image description)
const gw6Data = [
  {
    fixture_index: 0,
    home_team: 'Brentford',
    home_code: 'BRE',
    away_team: 'Manchester United',
    away_code: 'MUN',
    kickoff_time: '2025-09-27T12:30:00Z',
    result: 'H' // Brentford 3-1 Manchester United
  },
  {
    fixture_index: 1,
    home_team: 'Chelsea',
    home_code: 'CHE',
    away_team: 'Brighton & Hove Albion',
    away_code: 'BHA',
    kickoff_time: '2025-09-27T15:00:00Z',
    result: 'A' // Brighton & Hove Albion 3-1 Chelsea
  },
  {
    fixture_index: 2,
    home_team: 'Crystal Palace',
    home_code: 'CRY',
    away_team: 'Liverpool',
    away_code: 'LIV',
    kickoff_time: '2025-09-27T15:00:00Z',
    result: 'H' // Crystal Palace 2-1 Liverpool
  },
  {
    fixture_index: 3,
    home_team: 'Leeds United',
    home_code: 'LEE',
    away_team: 'AFC Bournemouth',
    away_code: 'BOU',
    kickoff_time: '2025-09-27T15:00:00Z',
    result: 'D' // Leeds United 2-2 AFC Bournemouth
  },
  {
    fixture_index: 4,
    home_team: 'Manchester City',
    home_code: 'MCI',
    away_team: 'Burnley',
    away_code: 'BUR',
    kickoff_time: '2025-09-27T15:00:00Z',
    result: 'H' // Manchester City 5-1 Burnley
  },
  {
    fixture_index: 5,
    home_team: 'Nottingham Forest',
    home_code: 'NFO',
    away_team: 'Sunderland',
    away_code: 'SUN',
    kickoff_time: '2025-09-27T17:30:00Z',
    result: 'A' // Sunderland 1-0 Nottingham Forest
  },
  {
    fixture_index: 6,
    home_team: 'Tottenham Hotspur',
    home_code: 'TOT',
    away_team: 'Wolverhampton Wanderers',
    away_code: 'WOL',
    kickoff_time: '2025-09-27T20:00:00Z',
    result: 'D' // Tottenham Hotspur 1-1 Wolverhampton Wanderers
  },
  {
    fixture_index: 7,
    home_team: 'Aston Villa',
    home_code: 'AVL',
    away_team: 'Fulham',
    away_code: 'FUL',
    kickoff_time: '2025-09-28T14:00:00Z',
    result: 'H' // Aston Villa 3-1 Fulham
  },
  {
    fixture_index: 8,
    home_team: 'Newcastle United',
    home_code: 'NEW',
    away_team: 'Arsenal',
    away_code: 'ARS',
    kickoff_time: '2025-09-28T16:30:00Z',
    result: 'A' // Arsenal 2-1 Newcastle United
  },
  {
    fixture_index: 9,
    home_team: 'Everton',
    home_code: 'EVE',
    away_team: 'West Ham United',
    away_code: 'WHU',
    kickoff_time: '2025-09-29T20:00:00Z',
    result: 'D' // Everton 1-1 West Ham United
  },
];

async function addGw6Data() {
  console.log('🔍 TRIPLE-CHECKING AND ADDING GW6 DATA...\n');

  try {
    // Check if GW6 already exists
    const { data: existingGw6, error: gw6Error } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 6);
    
    if (gw6Error) throw gw6Error;
    
    if (existingGw6.length > 0) {
      console.log(`⚠️  GW6 already has ${existingGw6.length} fixtures. Clearing them first...`);
      
      // Clear existing GW6 data
      await supabase.from('picks').delete().eq('gw', 6);
      await supabase.from('gw_submissions').delete().eq('gw', 6);
      await supabase.from('gw_results').delete().eq('gw', 6);
      await supabase.from('fixtures').delete().eq('gw', 6);
      console.log('✅ Existing GW6 data cleared');
    }

    // Add GW6 fixtures
    console.log('\n🏟️ Adding GW6 fixtures...');
    const fixtureRows = gw6Data.map(f => ({
      gw: 6,
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
    console.log(`✅ Added ${fixtureRows.length} GW6 fixtures`);

    // Add GW6 results
    console.log('\n🏆 Adding GW6 results...');
    const resultRows = gw6Data.map(f => ({
      gw: 6,
      fixture_index: f.fixture_index,
      result: f.result,
      decided_at: new Date().toISOString(),
    }));

    const { error: resultError } = await supabase
      .from('gw_results')
      .insert(resultRows);
    
    if (resultError) throw resultError;
    console.log(`✅ Added ${resultRows.length} GW6 results`);

    // Read CSV and add user picks
    console.log('\n📄 Reading GW6 CSV file...');
    const csvPath = path.join(__dirname, 'GW6.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`✅ Found ${records.length} player records in CSV`);

    // Process each user's picks
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

      for (let i = 0; i < gw6Data.length; i++) {
        const fixture = gw6Data[i];
        
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
            gw: 6,
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
        gw: 6,
        submitted_at: new Date().toISOString()
      });

      console.log(`   📊 ${playerName}: ${correctPredictions}/${userPicks.length} correct (${Math.round((correctPredictions/userPicks.length)*100)}%)`);
    }

    // Insert all picks
    console.log(`\n📝 Inserting ${allPicks.length} picks...`);
    const { error: picksError } = await supabase
      .from('picks')
      .insert(allPicks);
    
    if (picksError) throw picksError;
    console.log('✅ All picks inserted');

    // Insert submissions
    console.log(`\n📋 Inserting ${submissions.length} submissions...`);
    const { error: submissionsError } = await supabase
      .from('gw_submissions')
      .insert(submissions);
    
    if (submissionsError) throw submissionsError;
    console.log('✅ All submissions inserted');

    // Update meta table to current_gw = 6
    console.log('\n⚙️ Updating meta table...');
    const { error: metaUpdateError } = await supabase
      .from('meta')
      .upsert({ id: 1, current_gw: 6 });
    
    if (metaUpdateError) throw metaUpdateError;
    console.log('✅ Meta table updated to current_gw = 6');

    console.log('\n🎉 GW6 DATA SUCCESSFULLY ADDED!');

  } catch (error) {
    console.error('❌ Error adding GW6 data:', error);
  }
}

addGw6Data();
