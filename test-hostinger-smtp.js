// test-hostinger-smtp.js - Test both Hostinger and Titan SMTP servers
const nodemailer = require('nodemailer');
require('dotenv').config();

const testSMTPServers = async () => {
  console.log('🔧 Testing Hostinger SMTP servers...');
  console.log('Email:', process.env.HOSTINGER_EMAIL_USER);
  console.log('');

  // Test 1: Standard Hostinger SMTP
  console.log('1️⃣ Testing smtp.hostinger.com...');
  await testSMTPConfig({
    name: 'Hostinger SMTP',
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false }
  });

  console.log('');

  // Test 2: Titan SMTP (used by some Hostinger accounts)
  console.log('2️⃣ Testing smtp.titan.email...');
  await testSMTPConfig({
    name: 'Titan SMTP',
    host: 'smtp.titan.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false }
  });

  console.log('');

  // Test 3: Hostinger SSL
  console.log('3️⃣ Testing smtp.hostinger.com with SSL...');
  await testSMTPConfig({
    name: 'Hostinger SSL',
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    }
  });

  console.log('');

  // Test 4: Titan SSL
  console.log('4️⃣ Testing smtp.titan.email with SSL...');
  await testSMTPConfig({
    name: 'Titan SSL',
    host: 'smtp.titan.email',
    port: 465,
    secure: true,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    }
  });
};

const testSMTPConfig = async (config) => {
  try {
    const transporter = nodemailer.createTransport({
      ...config,
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    });

    console.log(`   Testing connection to ${config.host}:${config.port}...`);
    await transporter.verify();
    console.log(`   ✅ ${config.name} - CONNECTION SUCCESSFUL!`);
    
    // Try sending a test email
    console.log(`   Sending test email...`);
    const result = await transporter.sendMail({
      from: `"Jacal Test" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: 'ch408541@gmail.com',
      subject: `🔧 Test from ${config.name}`,
      html: `<h1>Success!</h1><p>This email was sent using ${config.name} (${config.host}:${config.port})</p>`
    });
    
    console.log(`   ✅ EMAIL SENT! Message ID: ${result.messageId}`);
    console.log(`   🎯 USE THIS CONFIGURATION!`);
    
  } catch (error) {
    console.log(`   ❌ ${config.name} failed: ${error.message}`);
  }
};

// Run the test
testSMTPServers().catch(console.error);