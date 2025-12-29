import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createSuperAdmin() {
  try {
    const username = process.argv[2] || 'superadmin';
    const password = process.argv[3] || 'changeme123';

    console.log('🔐 Creating Super Admin...');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('');

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Check if user exists
    const { data: existing, error: checkError } = await supabase
      .from('admins')
      .select('id, username')
      .eq('username', username)
      .single();

    if (existing) {
      console.log('⚠️  User already exists. Updating password...');

      const { error: updateError } = await supabase
        .from('admins')
        .update({
          password_hash: passwordHash,
          is_super_admin: true,
          role: 'super_admin',
          tenant_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('username', username);

      if (updateError) {
        throw updateError;
      }

      console.log('✅ Super Admin password updated successfully!');
    } else {
      console.log('Creating new Super Admin...');

      const { data, error: insertError } = await supabase
        .from('admins')
        .insert([
          {
            username,
            password_hash: passwordHash,
            is_super_admin: true,
            role: 'super_admin',
            tenant_id: null,
          },
        ])
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Super Admin created successfully!');
      console.log('User ID:', data[0].id);
    }

    console.log('');
    console.log('📋 Login Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change your password after first login!');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
