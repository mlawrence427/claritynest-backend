// ===========================================
// PDF Utility - Generate wealth reports
// ===========================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Color palette matching the frontend
const colors = {
  primary: '#4A6C6F',
  primaryDark: '#2C4A4D',
  accent: '#D4A373',
  success: '#68D391',
  danger: '#FC8181',
  textMain: '#2D3748',
  textMuted: '#718096',
  bgLight: '#F5F7F5'
};

// Generate wealth report PDF
const generateWealthReport = async (userData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'ClarityNest Wealth Report',
          Author: 'ClarityNest',
          Subject: `Wealth Report for ${userData.user.name || userData.user.email}`
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ==================== HEADER ====================
      doc.rect(0, 0, doc.page.width, 100).fill(colors.primary);
      doc.fillColor('white')
         .fontSize(28)
         .text('🌿 ClarityNest', 50, 35);
      doc.fontSize(12)
         .text('Your emotions, your money, your future — in sync.', 50, 70);
      
      // Report metadata
      doc.fillColor('white')
         .fontSize(10)
         .text(`Generated: ${new Date().toLocaleDateString()}`, 400, 35)
         .text(`User: ${userData.user.name || userData.user.email}`, 400, 50);

      doc.moveDown(4);

      // ==================== SUMMARY SECTION ====================
      doc.fillColor(colors.textMain)
         .fontSize(20)
         .text('Financial Summary', 50, 130);
      
      doc.moveTo(50, 155).lineTo(545, 155).stroke(colors.primary);
      doc.moveDown();

      // Net Worth Box
      const netWorth = userData.accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
      doc.rect(50, 170, 240, 80).fill(colors.bgLight);
      doc.fillColor(colors.textMuted).fontSize(10).text('NET WORTH', 70, 185);
      doc.fillColor(netWorth >= 0 ? colors.primary : colors.danger)
         .fontSize(28)
         .text(`$${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 70, 205);

      // Mood Score Box  
      const avgMood = userData.moods.length > 0 
        ? (userData.moods.reduce((sum, m) => sum + m.value, 0) / userData.moods.length).toFixed(1)
        : 'N/A';
      doc.rect(305, 170, 240, 80).fill(colors.bgLight);
      doc.fillColor(colors.textMuted).fontSize(10).text('AVG MOOD SCORE', 325, 185);
      doc.fillColor(colors.accent).fontSize(28).text(`${avgMood}/10`, 325, 205);

      doc.moveDown(6);

      // ==================== ACCOUNTS SECTION ====================
      doc.fillColor(colors.textMain).fontSize(16).text('Account Breakdown', 50, 280);
      doc.moveTo(50, 300).lineTo(545, 300).stroke(colors.primary);

      let yPos = 315;
      const accountTypes = {};
      
      userData.accounts.forEach(acc => {
        accountTypes[acc.type] = (accountTypes[acc.type] || 0) + parseFloat(acc.balance || 0);
        
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        const isNegative = acc.balance < 0;
        doc.fillColor(colors.textMain).fontSize(11).text(acc.name, 60, yPos);
        doc.fillColor(colors.textMuted).fontSize(9).text(acc.type, 60, yPos + 14);
        doc.fillColor(isNegative ? colors.danger : colors.success)
           .fontSize(11)
           .text(`$${parseFloat(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 400, yPos, { align: 'right', width: 145 });
        
        yPos += 40;
      });

      if (userData.accounts.length === 0) {
        doc.fillColor(colors.textMuted).fontSize(11).text('No accounts added yet.', 60, yPos);
        yPos += 30;
      }

      // ==================== ASSET ALLOCATION ====================
      yPos += 20;
      if (yPos > 600) {
        doc.addPage();
        yPos = 50;
      }

      doc.fillColor(colors.textMain).fontSize(16).text('Asset Allocation', 50, yPos);
      yPos += 25;
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke(colors.primary);
      yPos += 15;

      const typeColors = {
        'Cash': '#4A6C6F',
        'Savings': '#6B8E91',
        'Investment': '#D4A373',
        'Retirement': '#9AE6B4',
        'Crypto': '#FBD38D',
        'Debt': '#FC8181'
      };

      Object.entries(accountTypes).forEach(([type, amount]) => {
        const percentage = netWorth !== 0 ? ((amount / Math.abs(netWorth)) * 100).toFixed(1) : 0;
        
        doc.rect(60, yPos, 15, 15).fill(typeColors[type] || colors.primary);
        doc.fillColor(colors.textMain).fontSize(10).text(type, 85, yPos + 2);
        doc.fillColor(colors.textMuted).fontSize(10)
           .text(`$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${percentage}%)`, 300, yPos + 2, { align: 'right', width: 245 });
        
        yPos += 25;
      });

      // ==================== MOOD HISTORY ====================
      yPos += 30;
      if (yPos > 550) {
        doc.addPage();
        yPos = 50;
      }

      doc.fillColor(colors.textMain).fontSize(16).text('Recent Emotional Check-ins', 50, yPos);
      yPos += 25;
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke(colors.primary);
      yPos += 15;

      const recentMoods = userData.moods.slice(-10).reverse();
      
      if (recentMoods.length > 0) {
        // Table header
        doc.fillColor(colors.textMuted).fontSize(9);
        doc.text('DATE', 60, yPos);
        doc.text('SCORE', 180, yPos);
        doc.text('FEELINGS', 250, yPos);
        doc.text('NOTE', 380, yPos);
        yPos += 20;

        recentMoods.forEach(mood => {
          if (yPos > 750) {
            doc.addPage();
            yPos = 50;
          }

          const moodColor = mood.value >= 7 ? colors.success : mood.value >= 4 ? colors.accent : colors.danger;
          
          doc.fillColor(colors.textMain).fontSize(9);
          doc.text(new Date(mood.checkinDate || mood.createdAt).toLocaleDateString(), 60, yPos);
          doc.fillColor(moodColor).text(`${mood.value}/10`, 180, yPos);
          doc.fillColor(colors.textMuted)
             .text((mood.tags || []).slice(0, 3).join(', ') || '-', 250, yPos, { width: 120, ellipsis: true });
          doc.text((mood.note || '-').substring(0, 30), 380, yPos, { width: 150, ellipsis: true });
          
          yPos += 22;
        });
      } else {
        doc.fillColor(colors.textMuted).fontSize(11).text('No mood entries recorded yet.', 60, yPos);
      }

      // ==================== FOOTER ====================
      doc.fillColor(colors.textMuted)
         .fontSize(8)
         .text(
           `Generated by ClarityNest • ${new Date().toLocaleString()} • This report is for personal use only.`,
           50,
           doc.page.height - 30,
           { align: 'center', width: 495 }
         );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate simple transaction export PDF
const generateTransactionsPDF = async (userData, accountId = null) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fillColor(colors.primary).fontSize(20).text('ClarityNest - Transaction History', 50, 50);
      doc.fillColor(colors.textMuted).fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 50, 75);
      doc.moveDown(2);

      let yPos = 110;
      
      // Filter transactions by account if specified
      let transactions = userData.transactions || [];
      if (accountId) {
        transactions = transactions.filter(t => t.accountId === accountId);
        const account = userData.accounts.find(a => a.id === accountId);
        doc.fillColor(colors.textMain).fontSize(14).text(`Account: ${account?.name || 'Unknown'}`, 50, yPos);
        yPos += 30;
      }

      // Table header
      doc.fillColor(colors.textMuted).fontSize(9);
      doc.text('DATE', 50, yPos);
      doc.text('ACCOUNT', 130, yPos);
      doc.text('TYPE', 250, yPos);
      doc.text('NOTE', 320, yPos);
      doc.text('AMOUNT', 480, yPos, { align: 'right', width: 65 });
      yPos += 20;
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke(colors.bgLight);
      yPos += 10;

      transactions.slice(-100).reverse().forEach(tx => {
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }

        const account = userData.accounts.find(a => a.id === tx.accountId);
        const isPositive = tx.amount >= 0;
        
        doc.fillColor(colors.textMain).fontSize(9);
        doc.text(new Date(tx.transactionDate || tx.createdAt).toLocaleDateString(), 50, yPos);
        doc.text((account?.name || 'Unknown').substring(0, 15), 130, yPos);
        doc.text(tx.type, 250, yPos);
        doc.text((tx.note || '-').substring(0, 20), 320, yPos);
        doc.fillColor(isPositive ? colors.success : colors.danger)
           .text(`${isPositive ? '+' : ''}$${Math.abs(tx.amount).toLocaleString()}`, 480, yPos, { align: 'right', width: 65 });
        
        yPos += 20;
      });

      if (transactions.length === 0) {
        doc.fillColor(colors.textMuted).text('No transactions found.', 50, yPos);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateWealthReport,
  generateTransactionsPDF
};
