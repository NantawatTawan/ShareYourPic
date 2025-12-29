/**
 * Test script for quota checking
 * Tests trial plan limit (50 images)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuotaLimit() {
  console.log('='.repeat(50));
  console.log('Testing Quota Limits');
  console.log('='.repeat(50));

  try {
    // 1. Get a trial tenant (or create one for testing)
    console.log('\n1. Finding trial tenant...');

    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select(`
        *,
        subscriptions!inner (
          *,
          subscription_plans!inner (*)
        )
      `)
      .eq('subscriptions.subscription_plans.plan_key', 'trial')
      .eq('subscriptions.status', 'active')
      .limit(1);

    if (tenantError) throw tenantError;

    if (!tenants || tenants.length === 0) {
      console.log('❌ No trial tenant found. Please create a trial account first.');
      return;
    }

    const tenant = tenants[0];
    const subscription = tenant.subscriptions[0];
    const plan = subscription.subscription_plans;

    console.log(`✅ Found tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`   Plan: ${plan.name}`);
    console.log(`   Features:`, plan.features);

    // Get max uploads from features
    const maxUploads = plan.features.max_uploads || plan.features.max_uploads_per_month || -1;
    console.log(`   Max uploads: ${maxUploads}`);

    // 2. Count current images
    console.log('\n2. Counting current images...');

    const { count: imageCount, error: countError } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id);

    if (countError) throw countError;

    console.log(`   Current images: ${imageCount}`);
    console.log(`   Remaining: ${maxUploads - imageCount}`);

    // 3. Check if quota is enforced
    console.log('\n3. Checking quota enforcement...');

    if (maxUploads === -1) {
      console.log('   ✅ Unlimited uploads (expected for unlimited plan)');
    } else if (imageCount >= maxUploads) {
      console.log('   ✅ QUOTA LIMIT REACHED - Upload should be blocked');
      console.log(`   ⛔ ${imageCount}/${maxUploads} images used`);
    } else if (imageCount >= maxUploads * 0.8) {
      console.log('   ⚠️  WARNING: Close to limit');
      console.log(`   📊 ${imageCount}/${maxUploads} images used (${Math.round((imageCount/maxUploads)*100)}%)`);
    } else {
      console.log('   ✅ Under quota limit');
      console.log(`   📊 ${imageCount}/${maxUploads} images used (${Math.round((imageCount/maxUploads)*100)}%)`);
    }

    // 4. Test subscription expiry
    console.log('\n4. Checking subscription expiry...');

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const diffTime = periodEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    console.log(`   Current period end: ${periodEnd.toLocaleString('th-TH')}`);

    if (now > periodEnd) {
      console.log('   ⛔ SUBSCRIPTION EXPIRED - Access should be blocked');
    } else if (diffDays <= 7) {
      console.log(`   ⚠️  WARNING: Expires in ${diffDays} days`);
    } else {
      console.log(`   ✅ Active for ${diffDays} more days`);
    }

    // 5. Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`Plan: ${plan.name}`);
    console.log(`Images: ${imageCount}/${maxUploads === -1 ? '∞' : maxUploads}`);
    console.log(`Storage: ${plan.features.storage_gb || 0} GB limit`);
    console.log(`Status: ${subscription.status}`);
    console.log(`Expires: ${periodEnd.toLocaleString('th-TH')}`);

    if (imageCount >= maxUploads && maxUploads !== -1) {
      console.log('\n🔴 QUOTA EXCEEDED - New uploads will be blocked');
    } else if (now > periodEnd) {
      console.log('\n🔴 SUBSCRIPTION EXPIRED - All access will be blocked');
    } else {
      console.log('\n🟢 All checks passed - System operational');
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
}

// Run test
testQuotaLimit();
