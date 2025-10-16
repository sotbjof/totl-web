// scripts/manage-leagues.mjs
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

// User mapping (name to user_id)
const userMapping = {
  'Jof': '4542c037-5b38-40d0-b189-847b8f17c222',
  'Carl': 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2',
  'SP': '9c0bcf50-370d-412d-8826-95371a72b4fe',
  'ThomasJamesBird': '36f31625-6d6c-4aa4-815a-1493a812841b',
  'Ben New': '8e53f3fb-3842-423c-84d4-192496939632',
  'Paul N': 'a6f396b0-e370-4a6f-8ca8-102d1db8ee9d',
  'Phil Bolton': 'f09b62e6-792c-4fe1-a6ba-583d802781df',
};

async function manageLeagues() {
  console.log('🏆 Managing Mini Leagues...\n');

  try {
    // Step 1: Check current leagues
    console.log('📋 Checking current leagues...');
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('*');
    
    if (leaguesError) throw leaguesError;
    
    console.log(`✅ Found ${leagues.length} existing leagues:`);
    leagues.forEach(league => {
      console.log(`   - ${league.name} (ID: ${league.id})`);
    });

    // Step 2: Find and remove "Jof Carl League"
    console.log('\n🗑️ Looking for "Jof Carl League" to remove...');
    const jofCarlLeague = leagues.find(league => 
      league.name.toLowerCase().includes('jof') && 
      league.name.toLowerCase().includes('carl')
    );

    if (jofCarlLeague) {
      console.log(`✅ Found "Jof Carl League" (ID: ${jofCarlLeague.id})`);
      
      // First, remove all members from the league
      console.log('   Removing all members from the league...');
      const { error: membersError } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', jofCarlLeague.id);
      
      if (membersError) {
        console.error('❌ Error removing members:', membersError);
      } else {
        console.log('   ✅ All members removed');
      }

      // Then delete the league itself
      console.log('   Deleting the league...');
      const { error: deleteError } = await supabase
        .from('leagues')
        .delete()
        .eq('id', jofCarlLeague.id);
      
      if (deleteError) {
        console.error('❌ Error deleting league:', deleteError);
      } else {
        console.log('   ✅ League deleted successfully');
      }
    } else {
      console.log('ℹ️  No "Jof Carl League" found to remove');
    }

    // Step 3: Create "Prem Predictions" league
    console.log('\n🆕 Creating "Prem Predictions" league...');
    
    // Check if it already exists
    const existingPremLeague = leagues.find(league => 
      league.name.toLowerCase() === 'prem predictions'
    );

    let premLeagueId;
    if (existingPremLeague) {
      console.log(`ℹ️  "Prem Predictions" league already exists (ID: ${existingPremLeague.id})`);
      premLeagueId = existingPremLeague.id;
    } else {
      const { data: newLeague, error: createError } = await supabase
        .from('leagues')
        .insert({
          name: 'Prem Predictions',
          code: 'prem-predictions'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      premLeagueId = newLeague.id;
      console.log(`✅ Created "Prem Predictions" league (ID: ${premLeagueId})`);
    }

    // Step 4: Add users to "Prem Predictions" league
    console.log('\n👥 Adding users to "Prem Predictions" league...');
    
    const premUsersToAdd = ['Jof', 'Carl', 'SP', 'ThomasJamesBird'];
    
    for (const userName of premUsersToAdd) {
      const userId = userMapping[userName];
      
      if (!userId) {
        console.log(`⚠️  Skipping ${userName} - no user ID found`);
        continue;
      }

      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', premLeagueId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError) {
        console.error(`❌ Error checking membership for ${userName}:`, checkError);
        continue;
      }

      if (existingMember) {
        console.log(`ℹ️  ${userName} is already a member`);
        continue;
      }

      // Add user to league
      const { error: addError } = await supabase
        .from('league_members')
        .insert({
          league_id: premLeagueId,
          user_id: userId
        });

      if (addError) {
        console.error(`❌ Error adding ${userName}:`, addError);
      } else {
        console.log(`✅ Added ${userName} to "Prem Predictions" league`);
      }
    }

    // Step 5: Create "FC Football" league
    console.log('\n🆕 Creating "FC Football" league...');
    
    const existingFcLeague = leagues.find(league => 
      league.name.toLowerCase() === 'fc football'
    );

    let fcLeagueId;
    if (existingFcLeague) {
      console.log(`ℹ️  "FC Football" league already exists (ID: ${existingFcLeague.id})`);
      fcLeagueId = existingFcLeague.id;
    } else {
      const { data: newFcLeague, error: createFcError } = await supabase
        .from('leagues')
        .insert({
          name: 'FC Football',
          code: 'fc-football'
        })
        .select()
        .single();
      
      if (createFcError) throw createFcError;
      
      fcLeagueId = newFcLeague.id;
      console.log(`✅ Created "FC Football" league (ID: ${fcLeagueId})`);
    }

    // Add users to "FC Football" league
    console.log('\n👥 Adding users to "FC Football" league...');
    
    const fcUsersToAdd = ['Jof', 'Ben New', 'Paul N'];
    
    for (const userName of fcUsersToAdd) {
      const userId = userMapping[userName];
      
      if (!userId) {
        console.log(`⚠️  Skipping ${userName} - no user ID found`);
        continue;
      }

      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', fcLeagueId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError) {
        console.error(`❌ Error checking membership for ${userName}:`, checkError);
        continue;
      }

      if (existingMember) {
        console.log(`ℹ️  ${userName} is already a member`);
        continue;
      }

      // Add user to league
      const { error: addError } = await supabase
        .from('league_members')
        .insert({
          league_id: fcLeagueId,
          user_id: userId
        });

      if (addError) {
        console.error(`❌ Error adding ${userName}:`, addError);
      } else {
        console.log(`✅ Added ${userName} to "FC Football" league`);
      }
    }

    // Step 6: Create "Easy League" league
    console.log('\n🆕 Creating "Easy League" league...');
    
    const existingEasyLeague = leagues.find(league => 
      league.name.toLowerCase() === 'easy league'
    );

    let easyLeagueId;
    if (existingEasyLeague) {
      console.log(`ℹ️  "Easy League" league already exists (ID: ${existingEasyLeague.id})`);
      easyLeagueId = existingEasyLeague.id;
    } else {
      const { data: newEasyLeague, error: createEasyError } = await supabase
        .from('leagues')
        .insert({
          name: 'Easy League',
          code: 'easy-league'
        })
        .select()
        .single();
      
      if (createEasyError) throw createEasyError;
      
      easyLeagueId = newEasyLeague.id;
      console.log(`✅ Created "Easy League" league (ID: ${easyLeagueId})`);
    }

    // Add users to "Easy League" league
    console.log('\n👥 Adding users to "Easy League" league...');
    
    const easyUsersToAdd = ['Jof', 'Phil Bolton'];
    
    for (const userName of easyUsersToAdd) {
      const userId = userMapping[userName];
      
      if (!userId) {
        console.log(`⚠️  Skipping ${userName} - no user ID found`);
        continue;
      }

      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', easyLeagueId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError) {
        console.error(`❌ Error checking membership for ${userName}:`, checkError);
        continue;
      }

      if (existingMember) {
        console.log(`ℹ️  ${userName} is already a member`);
        continue;
      }

      // Add user to league
      const { error: addError } = await supabase
        .from('league_members')
        .insert({
          league_id: easyLeagueId,
          user_id: userId
        });

      if (addError) {
        console.error(`❌ Error adding ${userName}:`, addError);
      } else {
        console.log(`✅ Added ${userName} to "Easy League" league`);
      }
    }

    // Step 7: Verify final state
    console.log('\n🔍 Final verification...');
    
    // Get updated leagues
    const { data: finalLeagues, error: finalLeaguesError } = await supabase
      .from('leagues')
      .select('*');
    
    if (finalLeaguesError) throw finalLeaguesError;
    
    console.log(`\n📊 Final league count: ${finalLeagues.length}`);
    finalLeagues.forEach(league => {
      console.log(`   - ${league.name} (ID: ${league.id})`);
    });

    // Get members of all three leagues
    const leagueIds = [premLeagueId, fcLeagueId, easyLeagueId];
    const leagueNames = ['Prem Predictions', 'FC Football', 'Easy League'];
    
    for (let i = 0; i < leagueIds.length; i++) {
      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select(`
          *,
          users!inner(name)
        `)
        .eq('league_id', leagueIds[i]);
      
      if (membersError) throw membersError;
      
      console.log(`\n👥 "${leagueNames[i]}" league members (${members.length}):`);
      members.forEach(member => {
        console.log(`   - ${member.users.name} (${member.user_id})`);
      });
    }

    console.log('\n✅ League management complete!');

  } catch (error) {
    console.error('❌ Error managing leagues:', error);
  }
}

manageLeagues();
