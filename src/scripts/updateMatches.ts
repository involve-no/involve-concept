import * as XLSX from 'xlsx';
import path from 'path';
import { db } from '../lib/db';

const excelDateToJS = (serial: number) => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const remainder = serial - Math.floor(serial);
  const timeValue = Math.round(remainder * 86400);
  return new Date((utcValue + timeValue) * 1000);
};

function updateMatches() {
  console.log('Syncing match teams and kick-off times from Excel...');

  const excelPath = path.resolve(process.cwd(), 'WCup_2026_4.2.6_en.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Matches'];
  
  if (!sheet) {
    console.error('Error: Matches sheet not found in the Excel file');
    process.exit(1);
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Update statement for group stage matches (updates teams and date)
  const updateGroupStmt = db.prepare('UPDATE matches SET teamA = ?, teamB = ?, date = ? WHERE id = ?');
  
  // Update statement for knockout stage matches (only updates date)
  const updateKnockoutStmt = db.prepare('UPDATE matches SET date = ? WHERE id = ?');

  let groupCount = 0;
  let knockoutCount = 0;

  const runUpdates = db.transaction(() => {
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const matchNum = row[1];
      const dateSerial = row[5]; // Column F: Date (my time) which is the serial date-time

      if (typeof matchNum === 'number' && matchNum >= 1 && matchNum <= 104 && typeof dateSerial === 'number') {
        const matchId = `M${matchNum.toString().padStart(3, '0')}`;
        const kickoffDate = excelDateToJS(dateSerial);
        const dateIsoStr = kickoffDate.toISOString(); // E.g., '2026-06-11T21:00:00.000Z'

        if (matchNum <= 72) {
          const teamA = row[8];
          const teamB = row[9];
          if (teamA && teamB) {
            updateGroupStmt.run(teamA.trim(), teamB.trim(), dateIsoStr, matchId);
            groupCount++;
          }
        } else {
          updateKnockoutStmt.run(dateIsoStr, matchId);
          knockoutCount++;
        }
      }
    }
  });

  try {
    runUpdates();
    console.log(`Successfully synced database: ${groupCount} Group matches updated (teams + dates), ${knockoutCount} Knockout matches updated (dates only).`);
  } catch (err) {
    console.error('Failed to update matches in database:', err);
    process.exit(1);
  }
}

updateMatches();
