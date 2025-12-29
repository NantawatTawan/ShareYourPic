import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

/**
 * Send welcome email with login credentials
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.shopName - Shop/tenant name
 * @param {string} params.shopSlug - Shop slug for URL
 * @param {string} params.username - Auto-generated username
 * @param {string} params.password - Auto-generated password
 * @param {string} params.planName - Subscription plan name
 * @param {string} params.expiryDate - Subscription expiry date (formatted)
 */
export async function sendWelcomeEmail({
  to,
  shopName,
  shopSlug,
  username,
  password,
  planName,
  expiryDate,
}) {
  try {
    const loginUrl = `${process.env.FRONTEND_URL || 'https://yourdomain.com'}/${shopSlug}/admin/login`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🎉 ยินดีต้อนรับสู่ ShareYourPic - ${shopName}`,
      html: `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ShareYourPic</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #9333EA;
      margin: 0;
      font-size: 28px;
    }
    .header p {
      color: #666;
      margin: 5px 0 0 0;
    }
    .credentials-box {
      background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      color: white;
    }
    .credentials-box h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
    }
    .credential-item {
      background: rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 12px 16px;
      margin: 12px 0;
      backdrop-filter: blur(10px);
    }
    .credential-label {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 4px;
    }
    .credential-value {
      font-size: 16px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin: 20px 0;
      text-align: center;
    }
    .info-box {
      background: #F3F4F6;
      border-left: 4px solid #9333EA;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .info-box h3 {
      margin: 0 0 8px 0;
      color: #9333EA;
      font-size: 16px;
    }
    .info-box p {
      margin: 4px 0;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
      color: #6B7280;
      font-size: 12px;
    }
    .warning {
      background: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 12px;
      margin: 16px 0;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 ยินดีต้อนรับ!</h1>
      <p>บัญชีของคุณพร้อมใช้งานแล้ว</p>
    </div>

    <p>สวัสดีครับ,</p>
    <p>ขอบคุณที่เลือกใช้ ShareYourPic สำหรับ <strong>${shopName}</strong></p>
    <p>บัญชีของคุณได้ถูกสร้างเรียบร้อยแล้ว และพร้อมให้คุณเริ่มแชร์รูปภาพกับแขกของคุณได้ทันที!</p>

    <div class="credentials-box">
      <h2>🔐 ข้อมูลเข้าสู่ระบบของคุณ</h2>

      <div class="credential-item">
        <div class="credential-label">ชื่อผู้ใช้</div>
        <div class="credential-value">${username}</div>
      </div>

      <div class="credential-item">
        <div class="credential-label">รหัสผ่าน</div>
        <div class="credential-value">${password}</div>
      </div>
    </div>

    <div class="warning">
      ⚠️ <strong>สำคัญ:</strong> กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก
    </div>

    <div style="text-align: center;">
      <a href="${loginUrl}" class="button">เข้าสู่ระบบ Admin Panel</a>
    </div>

    <div class="info-box">
      <h3>📦 แพ็คเกจของคุณ</h3>
      <p><strong>แผน:</strong> ${planName}</p>
      <p><strong>หมดอายุ:</strong> ${expiryDate}</p>
      <p><strong>URL สำหรับแขก:</strong> <a href="${process.env.FRONTEND_URL || 'https://yourdomain.com'}/${shopSlug}/display">${process.env.FRONTEND_URL || 'https://yourdomain.com'}/${shopSlug}/display</a></p>
    </div>

    <div class="info-box">
      <h3>🚀 เริ่มต้นใช้งาน</h3>
      <p>1. <strong>เข้าสู่ระบบ:</strong> ใช้ชื่อผู้ใช้และรหัสผ่านด้านบน</p>
      <p>2. <strong>ปรับแต่งการตั้งค่า:</strong> เปลี่ยนชื่อ, คำอธิบาย, และการตั้งค่าการแสดงผล</p>
      <p>3. <strong>แชร์ URL:</strong> ให้แขกอัปโหลดรูปภาพผ่าน /${shopSlug}/upload</p>
      <p>4. <strong>ดูรูปภาพ:</strong> แสดงบนหน้าจอใหญ่ผ่าน /${shopSlug}/display</p>
    </div>

    <div class="footer">
      <p>หากคุณมีคำถามหรือต้องการความช่วยเหลือ</p>
      <p>กรุณาติดต่อเราที่ <a href="mailto:support@yourdomain.com">support@yourdomain.com</a></p>
      <p style="margin-top: 16px;">© 2024 ShareYourPic. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }

    console.log('Welcome email sent:', data);
    return data;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw error;
  }
}

/**
 * Send payment receipt email
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.shopName - Shop/tenant name
 * @param {string} params.planName - Plan name
 * @param {number} params.amount - Amount paid (in smallest currency unit)
 * @param {string} params.currency - Currency code (e.g., 'thb')
 * @param {string} params.paymentIntentId - Stripe payment intent ID
 * @param {string} params.paidAt - Payment date (formatted)
 */
export async function sendPaymentReceipt({
  to,
  shopName,
  planName,
  amount,
  currency,
  paymentIntentId,
  paidAt,
}) {
  try {
    const formattedAmount = (amount / 100).toLocaleString('th-TH', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🧾 ใบเสร็จการชำระเงิน - ${shopName}`,
      html: `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #10B981;
      margin: 0;
      font-size: 28px;
    }
    .receipt-box {
      border: 2px solid #E5E7EB;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .receipt-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #F3F4F6;
    }
    .receipt-row:last-child {
      border-bottom: none;
      font-weight: bold;
      font-size: 18px;
      color: #10B981;
    }
    .receipt-label {
      color: #6B7280;
    }
    .receipt-value {
      font-weight: 500;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
      color: #6B7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ ชำระเงินสำเร็จ</h1>
      <p>ขอบคุณสำหรับการชำระเงิน</p>
    </div>

    <div class="receipt-box">
      <h2 style="margin-top: 0;">รายละเอียดการชำระเงิน</h2>

      <div class="receipt-row">
        <span class="receipt-label">ร้าน/งาน:</span>
        <span class="receipt-value">${shopName}</span>
      </div>

      <div class="receipt-row">
        <span class="receipt-label">แผน:</span>
        <span class="receipt-value">${planName}</span>
      </div>

      <div class="receipt-row">
        <span class="receipt-label">วันที่ชำระ:</span>
        <span class="receipt-value">${paidAt}</span>
      </div>

      <div class="receipt-row">
        <span class="receipt-label">หมายเลขธุรกรรม:</span>
        <span class="receipt-value">${paymentIntentId}</span>
      </div>

      <div class="receipt-row">
        <span class="receipt-label">ยอดรวม:</span>
        <span class="receipt-value">${formattedAmount}</span>
      </div>
    </div>

    <p style="text-align: center; color: #6B7280;">
      ใบเสร็จนี้เป็นการยืนยันการชำระเงินของคุณ<br>
      กรุณาเก็บไว้เพื่อการอ้างอิงในอนาคต
    </p>

    <div class="footer">
      <p>หากคุณมีคำถามเกี่ยวกับการชำระเงินนี้</p>
      <p>กรุณาติดต่อเราที่ <a href="mailto:support@yourdomain.com">support@yourdomain.com</a></p>
      <p style="margin-top: 16px;">© 2024 ShareYourPic. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Error sending payment receipt:', error);
      throw error;
    }

    console.log('Payment receipt sent:', data);
    return data;
  } catch (error) {
    console.error('Failed to send payment receipt:', error);
    throw error;
  }
}

/**
 * Send subscription expiry warning email
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.shopName - Shop/tenant name
 * @param {string} params.shopSlug - Shop slug
 * @param {string} params.expiryDate - Expiry date (formatted)
 * @param {number} params.daysLeft - Days until expiry
 */
export async function sendExpiryWarning({
  to,
  shopName,
  shopSlug,
  expiryDate,
  daysLeft,
}) {
  try {
    const renewUrl = `${process.env.FRONTEND_URL || 'https://yourdomain.com'}/pricing?renew=${shopSlug}`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `⚠️ แพ็คเกจของคุณกำลังจะหมดอายุ - ${shopName}`,
      html: `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expiry Warning</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #F59E0B;
      margin: 0;
      font-size: 28px;
    }
    .warning-box {
      background: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 20px;
      margin: 24px 0;
      border-radius: 8px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
      color: #6B7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ แพ็คเกจกำลังจะหมดอายุ</h1>
    </div>

    <p>สวัสดีครับ,</p>
    <p>แพ็คเกจของคุณสำหรับ <strong>${shopName}</strong> กำลังจะหมดอายุในอีก <strong>${daysLeft} วัน</strong></p>

    <div class="warning-box">
      <p style="margin: 0;"><strong>วันที่หมดอายุ:</strong> ${expiryDate}</p>
      <p style="margin: 8px 0 0 0;">หลังจากวันที่หมดอายุ บัญชีของคุณจะถูกปิดการใช้งาน</p>
    </div>

    <p>เพื่อให้บริการของคุณไม่หยุดชะงัก กรุณาต่ออายุแพ็คเกจของคุณก่อนวันที่หมดอายุ</p>

    <div style="text-align: center;">
      <a href="${renewUrl}" class="button">ต่ออายุแพ็คเกจ</a>
    </div>

    <div class="footer">
      <p>หากคุณมีคำถาม กรุณาติดต่อเราที่</p>
      <p><a href="mailto:support@yourdomain.com">support@yourdomain.com</a></p>
      <p style="margin-top: 16px;">© 2024 ShareYourPic. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Error sending expiry warning:', error);
      throw error;
    }

    console.log('Expiry warning sent:', data);
    return data;
  } catch (error) {
    console.error('Failed to send expiry warning:', error);
    throw error;
  }
}
