// ===========================================
// Email Utility - Password reset & notifications
// ===========================================

const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const createTransporter = () => {
  // For development/testing, use ethereal email
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'test@ethereal.email',
        pass: 'test'
      }
    });
  }
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, userName) => {
  const transporter = createTransporter();
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"ClarityNest" <${process.env.EMAIL_FROM || 'noreply@claritynest.com'}>`,
    to: email,
    subject: 'Reset Your ClarityNest Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #2D3748; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4A6C6F; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #E2E8F0; }
          .button { display: inline-block; background: #4A6C6F; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #718096; border-radius: 0 0 12px 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌿 ClarityNest</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${userName || 'there'},</p>
            <p>We received a request to reset your ClarityNest password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you didn't request this reset, you can safely ignore this email. Your password won't be changed.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="font-size: 12px; color: #718096;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #4A6C6F;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ClarityNest. Your emotions, your money, your future — in sync.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ClarityNest Password Reset
      
      Hi ${userName || 'there'},
      
      We received a request to reset your password. Visit the following link to create a new password:
      
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this reset, you can safely ignore this email.
      
      - The ClarityNest Team
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    
    // For development, log the preview URL
    if (process.env.NODE_ENV === 'development') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, userName) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"ClarityNest" <${process.env.EMAIL_FROM || 'noreply@claritynest.com'}>`,
    to: email,
    subject: 'Welcome to ClarityNest! 🌿',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #2D3748; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4A6C6F; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #E2E8F0; }
          .feature { padding: 15px; margin: 10px 0; background: #F7FAFC; border-radius: 8px; }
          .button { display: inline-block; background: #D4A373; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #718096; border-radius: 0 0 12px 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌿 Welcome to ClarityNest</h1>
            <p>Your emotions, your money, your future — in sync.</p>
          </div>
          <div class="content">
            <h2>Hi ${userName || 'there'}!</h2>
            <p>Thank you for joining ClarityNest. We're excited to help you build a healthier relationship with your finances.</p>
            
            <h3>Get Started:</h3>
            <div class="feature">📊 <strong>Add Your Accounts</strong> - Track all your financial accounts in one place</div>
            <div class="feature">😌 <strong>Daily Check-ins</strong> - Log your emotional state to understand money behaviors</div>
            <div class="feature">🔮 <strong>Future View</strong> - See where your wealth is headed</div>
            <div class="feature">🤝 <strong>Community</strong> - Share wins and learn from others</div>
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}" class="button">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ClarityNest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Welcome email error:', error);
    // Don't throw - welcome emails are not critical
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail
};
