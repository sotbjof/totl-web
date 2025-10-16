// scripts/delete-users.mjs
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

// Users to delete
const usersToDelete = [
  { name: 'Carlini', id: '2963128f-7ba6-4854-a96f-4624c1ab17dc' },
  { name: 'sotbjof', id: '10a4244a-580b-4ef3-8fd2-bd141f66550c' }
];

async function deleteUsers() {
  console.log('🗑️ Deleting users Carlini and sotbjof...\n');

  try {
    for (const user of usersToDelete) {
      console.log(`👤 Processing ${user.name} (ID: ${user.id})...`);

      // Step 1: Check what data exists for this user
      console.log('   🔍 Checking existing data...');
      
      // Check picks
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', user.id);
      
      if (picksError) throw picksError;
      console.log(`   📊 Found ${picks.length} picks`);

      // Check submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('gw_submissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (submissionsError) throw submissionsError;
      console.log(`   📝 Found ${submissions.length} submissions`);

      // Check league memberships
      const { data: leagueMembers, error: leagueError } = await supabase
        .from('league_members')
        .select('*')
        .eq('user_id', user.id);
      
      if (leagueError) throw leagueError;
      console.log(`   🏆 Found ${leagueMembers.length} league memberships`);

      // Step 2: Delete user data in correct order (to avoid foreign key constraints)
      console.log('   🗑️ Deleting user data...');

      // Delete picks first
      if (picks.length > 0) {
        const { error: deletePicksError } = await supabase
          .from('picks')
          .delete()
          .eq('user_id', user.id);
        
        if (deletePicksError) throw deletePicksError;
        console.log(`   ✅ Deleted ${picks.length} picks`);
      }

      // Delete submissions
      if (submissions.length > 0) {
        const { error: deleteSubmissionsError } = await supabase
          .from('gw_submissions')
          .delete()
          .eq('user_id', user.id);
        
        if (deleteSubmissionsError) throw deleteSubmissionsError;
        console.log(`   ✅ Deleted ${submissions.length} submissions`);
      }

      // Delete league memberships
      if (leagueMembers.length > 0) {
        const { error: deleteLeagueError } = await supabase
          .from('league_members')
          .delete()
          .eq('user_id', user.id);
        
        if (deleteLeagueError) throw deleteLeagueError;
        console.log(`   ✅ Deleted ${leagueMembers.length} league memberships`);
      }

      // Finally, delete the user record
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);
      
      if (deleteUserError) throw deleteUserError;
      console.log(`   ✅ Deleted user ${user.name}`);

      console.log(`   ✅ ${user.name} completely removed from database\n`);
    }

    // Step 3: Verify deletion
    console.log('🔍 Verifying deletion...');
    
    const { data: remainingUsers, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .order('name');
    
    if (usersError) throw usersError;
    
    console.log(`\n📊 Remaining users (${remainingUsers.length}):`);
    remainingUsers.forEach(user => {
      console.log(`   - ${user.name} (ID: ${user.id})`);
    });

    // Check if the deleted users are gone
    const deletedUserIds = usersToDelete.map(u => u.id);
    const foundDeletedUsers = remainingUsers.filter(user => 
      deletedUserIds.includes(user.id)
    );

    if (foundDeletedUsers.length === 0) {
      console.log('\n✅ SUCCESS: Carlini and sotbjof have been completely removed!');
    } else {
      console.log('\n❌ WARNING: Some users may not have been fully deleted');
      foundDeletedUsers.forEach(user => {
        console.log(`   - ${user.name} still exists`);
      });
    }

  } catch (error) {
    console.error('❌ Error deleting users:', error);
  }
}

deleteUsers();
