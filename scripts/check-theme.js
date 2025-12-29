import { db } from '../src/config/database.js';

(async () => {
  try {
    const result = await db.supabase
      .from('tenants')
      .select('slug, name, theme_settings')
      .eq('slug', 'default')
      .single();

    console.log('Current Default Theme:');
    console.log(JSON.stringify(result.data, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
