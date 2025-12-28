import bcrypt from 'bcrypt';
import { supabase } from '../src/config/database.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    console.log('\n=== Create Admin User (Multi-Tenant) ===\n');

    // ถามว่าจะสร้าง super admin หรือ tenant admin
    const adminTypeInput = await question('Admin type (1=Super Admin, 2=Tenant Admin): ');
    const adminType = adminTypeInput.trim();

    const username = await question('Enter username: ');
    const password = await question('Enter password: ');

    if (!username || !password) {
      console.error('Username and password are required');
      rl.close();
      return;
    }

    let tenantId = null;
    let isSuperAdmin = false;
    let role = 'admin';

    if (adminType === '1') {
      // Super Admin
      isSuperAdmin = true;
      role = 'super_admin';
      console.log('\n→ Creating Super Admin (access all tenants)');
    } else {
      // Tenant Admin
      console.log('\n→ Creating Tenant Admin');

      // แสดงรายชื่อ tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, slug, name')
        .eq('is_active', true)
        .order('name');

      if (tenantsError) {
        console.error('Error fetching tenants:', tenantsError.message);
        rl.close();
        return;
      }

      if (!tenants || tenants.length === 0) {
        console.error('\nNo active tenants found. Please create a tenant first.');
        rl.close();
        return;
      }

      console.log('\nAvailable Tenants:');
      tenants.forEach((tenant, index) => {
        console.log(`  ${index + 1}. ${tenant.name} (/${tenant.slug})`);
      });

      const tenantChoice = await question(`\nSelect tenant (1-${tenants.length}): `);
      const tenantIndex = parseInt(tenantChoice) - 1;

      if (tenantIndex < 0 || tenantIndex >= tenants.length) {
        console.error('Invalid tenant selection');
        rl.close();
        return;
      }

      tenantId = tenants[tenantIndex].id;
      console.log(`\n→ Creating admin for: ${tenants[tenantIndex].name}`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert into database
    const { data, error } = await supabase
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        tenant_id: tenantId,
        is_super_admin: isSuperAdmin,
        role: role
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.error('\n✗ Error: Username already exists');
      } else {
        console.error('\n✗ Error:', error.message);
      }
    } else {
      console.log('\n✓ Admin user created successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Username:', username);
      console.log('Role:', role);
      console.log('Super Admin:', isSuperAdmin ? 'Yes' : 'No');
      console.log('ID:', data.id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (isSuperAdmin) {
        console.log('\n📌 Login URL: /super-admin/login');
      } else {
        // แสดง tenant slug
        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug')
          .eq('id', tenantId)
          .single();

        if (tenant) {
          console.log(`\n📌 Login URL: /${tenant.slug}/admin/login`);
        }
      }
    }

    rl.close();
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
  }
}

createAdmin();
