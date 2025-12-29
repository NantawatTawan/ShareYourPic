import { supabase } from './src/config/database.js';

async function testSlugCheck(slug) {
  console.log(`\n🔍 Testing slug: "${slug}"`);

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.log('❌ Invalid format');
    return { available: false, reason: 'invalid_format' };
  }

  if (slug.length < 3) {
    console.log('❌ Too short');
    return { available: false, reason: 'too_short' };
  }

  // Check in database
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  console.log('Database response:', { data, error: error?.code });

  // PGRST116 = not found (slug is available)
  if (error && error.code === 'PGRST116') {
    console.log('✅ Slug is available (not found in database)');
    return { available: true };
  }

  // Other errors
  if (error) {
    console.log('❌ Database error:', error.message);
    throw error;
  }

  // If data exists, slug is taken
  console.log('❌ Slug is taken (found in database)');
  return { available: false };
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('Testing Slug Check Logic');
  console.log('='.repeat(50));

  // Test 1: New slug (should be available)
  await testSlugCheck('my-new-event-12345');

  // Test 2: Check existing tenants
  const { data: existingTenants } = await supabase
    .from('tenants')
    .select('slug')
    .limit(3);

  console.log('\n📋 Existing slugs in database:', existingTenants?.map(t => t.slug) || []);

  if (existingTenants && existingTenants.length > 0) {
    // Test with existing slug
    await testSlugCheck(existingTenants[0].slug);
  }

  // Test 3: Invalid format
  await testSlugCheck('UPPERCASE');

  // Test 4: Too short
  await testSlugCheck('ab');

  console.log('\n' + '='.repeat(50));
  console.log('✅ Tests completed!');
  console.log('='.repeat(50));
}

runTests().catch(console.error);
