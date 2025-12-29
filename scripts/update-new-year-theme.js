import { db } from '../src/config/database.js';

// 🎉 New Year Chiang Mai Theme - สีสดใส เทศกาลปีใหม่
const newYearTheme = {
  // สีหลัก - ทองสว่าง (Gold)
  primaryColor: '#FFD700',

  // สีรอง - แดงสด (Red for celebration)
  secondaryColor: '#FF4444',

  // พื้นหลัง - Gradient แบบ dynamic (ใช้ใน CSS)
  // จะใช้ from-red-600 via-orange-500 to-yellow-400
  backgroundColor: '#FEF3C7', // Fallback: ครีมทอง

  // สีข้อความ - ขาว
  textColor: '#FFFFFF',

  // ฟอนต์
  fontFamily: 'Inter, "Noto Sans Thai", sans-serif',

  // Title
  title: '🎊 New Year 2025 - Chiang Mai 🎉',

  // Custom CSS สำหรับ gradient backgrounds
  customCSS: `
    :root {
      --gradient-new-year: linear-gradient(135deg,
        #DC2626 0%,    /* red-600 */
        #F97316 25%,   /* orange-500 */
        #FBBF24 50%,   /* yellow-400 */
        #DC2626 75%,   /* red-600 */
        #F97316 100%   /* orange-500 */
      );

      --gradient-card: linear-gradient(135deg,
        rgba(255, 255, 255, 0.2) 0%,
        rgba(255, 215, 0, 0.1) 100%
      );
    }

    /* Apply gradient to body */
    body {
      background: var(--gradient-new-year);
      background-size: 400% 400%;
      animation: gradientShift 15s ease infinite;
    }

    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* Card backgrounds */
    .bg-card {
      background: var(--gradient-card);
      backdrop-filter: blur(10px);
    }

    /* Glowing text effect for headers */
    h1, h2, .glow-text {
      text-shadow:
        0 0 10px rgba(255, 215, 0, 0.5),
        0 0 20px rgba(255, 215, 0, 0.3),
        0 0 30px rgba(255, 215, 0, 0.2);
    }

    /* Button hover effects */
    button:hover {
      box-shadow:
        0 0 15px rgba(255, 215, 0, 0.6),
        0 0 30px rgba(255, 68, 68, 0.4);
      transform: scale(1.05);
      transition: all 0.3s ease;
    }

    /* Firework particles effect */
    @keyframes sparkle {
      0%, 100% { opacity: 0; transform: scale(0); }
      50% { opacity: 1; transform: scale(1); }
    }
  `
};

(async () => {
  try {
    console.log('🎨 Updating theme to New Year Chiang Mai style...\n');
    console.log('New Theme Settings:');
    console.log(JSON.stringify(newYearTheme, null, 2));

    const { error } = await db.supabase
      .from('tenants')
      .update({ theme_settings: newYearTheme })
      .eq('slug', 'default');

    if (error) {
      console.error('❌ Error updating theme:', error);
      process.exit(1);
    }

    console.log('\n✅ Theme updated successfully!');
    console.log('🎉 New Year Chiang Mai theme is now active!');
    console.log('\nColors:');
    console.log('  Primary (Gold): #FFD700');
    console.log('  Secondary (Red): #FF4444');
    console.log('  Background: Gradient (Red → Orange → Yellow)');
    console.log('  Text: #FFFFFF (White)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
