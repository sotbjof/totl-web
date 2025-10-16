// scripts/get-real-user-ids.mjs
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

async function getRealUserIds() {
  console.log('👥 Getting all user IDs from database...\n');

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .order('name');
    
    if (usersError) throw usersError;
    
    console.log('📋 All users in database:');
    users.forEach(user => {
      console.log(`   - ${user.name} (ID: ${user.id})`);
    });

    // Look for users with names containing SP or Thomas
    console.log('\n🔍 Looking for SP and Thomas users...');
    const spUser = users.find(user => 
      user.name.toLowerCase().includes('sp') || 
      user.name.toLowerCase() === 'sp'
    );
    
    const thomasUser = users.find(user => 
      user.name.toLowerCase().includes('thomas') && 
      user.name.toLowerCase().includes('bird')
    );

    if (spUser) {
      console.log(`✅ Found SP: ${spUser.name} (ID: ${spUser.id})`);
    } else {
      console.log('❌ SP user not found');
    }

    if (thomasUser) {
      console.log(`✅ Found Thomas: ${thomasUser.name} (ID: ${thomasUser.id})`);
    } else {
      console.log('❌ Thomas user not found');
    }

  } catch (error) {
    console.error('❌ Error getting user IDs:', error);
  }
}

getRealUserIds();
