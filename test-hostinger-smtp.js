// test-hostinger-smtp.js - Direct SMTP test for Hostinger
const nodemailer = require('nodemailer');
require('dotenv').config();

// Debug nodemailer import
console.log('🔍 Nodemailer debug:');
console.log('typeof nodemailer:', typeof nodemailer);
console.log('nodemailer.createTransport:', typeof nodemailer.createTransport);
console.log('nodemailer keys:', Object.keys(nodemailer));
console.log('');

async function testHostingerSMTP() {
  console.log('🧪 === HOSTINGER SMTP TEST ===\n');
  
  // Check environment variables
  console.log('🔍 Environment Variables:');
  console.log('HOSTINGER_EMAIL_USER:', process.env.HOSTINGER_EMAIL_USER || '❌ NOT SET');
  console.log('HOSTINGER_EMAIL_PASSWORD:', process.env.HOSTINGER_EMAIL_PASSWORD ? '✅ SET (****)' : '❌ NOT SET');
  console.log('');

  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.log('❌ Missing Hostinger credentials in .env file');
    console.log('📝 Add these to your .env file:');
    console.log('HOSTINGER_EMAIL_USER=your-email@yourdomain.com');
    console.log('HOSTINGER_EMAIL_PASSWORD=your-email-password');
    return;
  }

  // Test configurations for Hostinger
  const configs = [
    {
      name: 'Hostinger TLS (Port 587) - RECOMMENDED',
      config: {
        host: 'smtp.hostinger.com',
        port: 587,
        secure: false, // false for TLS
        auth: {
          user: process.env.HOSTINGER_EMAIL_USER,
          pass: process.env.HOSTINGER_EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Hostinger SSL (Port 465)',
      config: {
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true, // true for SSL
        auth: {
          user: process.env.HOSTINGER_EMAIL_USER,
          pass: process.env.HOSTINGER_EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Hostinger with enhanced TLS',
      config: {
        host: 'smtp.hostinger.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.HOSTINGER_EMAIL_USER,
          pass: process.env.HOSTINGER_EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      }
    }
  ];

  let workingConfig = null;

  for (const { name, config } of configs) {
    console.log(`🔄 Testing: ${name}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Secure: ${config.secure}`);
    console.log(`   User: ${config.auth.user}`);
    
    try {
      const transporter = nodemailer.createTransport(config); // Fixed: createTransport not createTransporter
      
      // Test connection
      console.log('   🔗 Testing connection...');
      const verified = await transporter.verify();
      
      if (verified) {
        console.log('   ✅ Connection successful!');
        workingConfig = { name, config, transporter };
        break;
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      // Provide specific error guidance
      if (error.code === 'EAUTH') {
        console.log('   💡 Authentication failed - check email/password');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   💡 Connection timeout - try different port');
      } else if (error.code === 'ECONNECTION') {
        console.log('   💡 Connection refused - check SMTP settings');
      }
    }
    console.log('');
  }

  if (!workingConfig) {
    console.log('❌ All configurations failed!');
    console.log('\n🛠️ Troubleshooting Steps:');
    console.log('1. Verify your Hostinger email account exists');
    console.log('2. Check if your email password is correct');
    console.log('3. Login to https://hpanel.hostinger.com and check Emails section');
    console.log('4. Try creating a new email account password');
    console.log('5. Check if 2FA is enabled (you might need an app password)');
    console.log('6. Verify your domain\'s DNS/MX records are set up correctly');
    return;
  }

  // Send test email
  console.log(`🎉 Using working configuration: ${workingConfig.name}`);
  console.log('\n📧 Sending test email...');

  const testEmail = {
    from: `"Jacal Test" <${process.env.HOSTINGER_EMAIL_USER}>`,
    to: 'ch408541@gmail.com', // Your test email
    subject: '🧪 Hostinger SMTP Test - ' + new Date().toLocaleString(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
          <h1>🧪 SMTP Test Successful!</h1>
          <p>Your Hostinger SMTP is working correctly</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9; margin-top: 20px; border-radius: 10px;">
          <h2>Test Details</h2>
          <p><strong>Configuration:</strong> ${workingConfig.name}</p>
          <p><strong>Host:</strong> ${workingConfig.config.host}</p>
          <p><strong>Port:</strong> ${workingConfig.config.port}</p>
          <p><strong>Secure:</strong> ${workingConfig.config.secure}</p>
          <p><strong>From:</strong> ${process.env.HOSTINGER_EMAIL_USER}</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <hr>
          <p>✅ If you received this email, your Hostinger SMTP is configured correctly!</p>
        </div>
      </div>
    `
  };

  try {
    const result = await workingConfig.transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('📨 Message ID:', result.messageId);
    console.log('📬 Accepted:', result.accepted);
    console.log('❌ Rejected:', result.rejected);
    console.log('📝 Response:', result.response);
    console.log('\n🎯 Check your inbox at ch408541@gmail.com');
    
  } catch (error) {
    console.log('❌ Failed to send test email:', error.message);
    console.log('📝 Full error:', error);
  }
}

// Run the test
testHostingerSMTP().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.log('❌ Test failed:', error);
  process.exit(1);
});