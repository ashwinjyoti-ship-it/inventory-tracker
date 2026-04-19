import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read Excel file
const excelFile = path.join(__dirname, '../../NCPA_Inventory_All.xlsx');
const workbook = XLSX.readFile(excelFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Parse data
const data = XLSX.utils.sheet_to_json(sheet);

// Venue mapping from Excel columns to venue names
const venueMap = {
  'JBT': 1,
  'TATA': 2,
  'TET': 3,
  'LT': 4,
  'GDT': 5,
  'OFFICE': 6
};

// Generate SQL insert statements
const sqlStatements = [];

// Track equipment and items
const equipmentMap = new Map(); // name -> id
let equipmentId = 1;
let itemId = 1;
const equipmentItemCount = new Map(); // equipment_id -> count

console.log('Parsing Excel data...');
console.log(`Total rows: ${data.length}`);

// Process each row in Excel
data.forEach((row, index) => {
  const equipmentName = row['EQUIPMENT NAME'];
  const category = row['CATEGORY'];

  if (!equipmentName || !category) {
    console.log(`Skipping row ${index + 2}: missing equipment name or category`);
    return;
  }

  // Create equipment entry if not exists
  if (!equipmentMap.has(equipmentName)) {
    const sqlName = equipmentName.replace(/'/g, "''");
    const sqlCategory = category.replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO equipment (id, name, category) VALUES (${equipmentId}, '${sqlName}', '${sqlCategory}');`
    );
    equipmentMap.set(equipmentName, equipmentId);
    equipmentItemCount.set(equipmentId, 0);
    equipmentId++;
  }

  const currentEquipmentId = equipmentMap.get(equipmentName);

  // Create items based on quantities at each venue
  Object.entries(venueMap).forEach(([venueName, venueId]) => {
    const quantityKey = venueName;
    const quantity = parseInt(row[quantityKey]) || 0;

    for (let i = 0; i < quantity; i++) {
      const itemNumber = String(equipmentItemCount.get(currentEquipmentId) + i + 1).padStart(3, '0');
      const sqlName = equipmentName.replace(/'/g, "''");

      sqlStatements.push(
        `INSERT INTO items (id, equipment_id, item_number, home_venue_id, current_venue_id, status) ` +
        `VALUES (${itemId}, ${currentEquipmentId}, '${itemNumber}', ${venueId}, ${venueId}, 'available');`
      );
      itemId++;
    }

    equipmentItemCount.set(currentEquipmentId, equipmentItemCount.get(currentEquipmentId) + quantity);
  });
});

// Add initial venues
const venueInserts = [
  "INSERT OR IGNORE INTO venues (id, name, description) VALUES (1, 'JBT', 'JBT Storage and Performance Space');",
  "INSERT OR IGNORE INTO venues (id, name, description) VALUES (2, 'TATA', 'TATA Storage and Performance Space');",
  "INSERT OR IGNORE INTO venues (id, name, description) VALUES (3, 'TET', 'TET Storage and Performance Space');",
  "INSERT OR IGNORE INTO venues (id, name, description) VALUES (4, 'LT', 'LT Storage and Performance Space');",
  "INSERT OR IGNORE INTO venues (id, name, description) VALUES (5, 'GDT', 'GDT Storage and Performance Space');",
  "INSERT OR IGNORE INTO venues (id, name, description) VALUES (6, 'OFFICE', 'Administrative Office');",
];

// Add initial crew members (placeholder names)
const crewInserts = [
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (1, 'John Smith', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (2, 'Sarah Johnson', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (3, 'Mike Davis', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (4, 'Emily Wilson', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (5, 'Alex Martinez', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (6, 'Chris Anderson', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (7, 'Lisa Taylor', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (8, 'James Brown', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (9, 'Diana Lee', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (10, 'Robert Garcia', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (11, 'Michelle White', 'crew');",
  "INSERT OR IGNORE INTO crew_members (id, name, role) VALUES (12, 'Admin User', 'admin');",
];

// Combine all statements
const allStatements = [...venueInserts, ...crewInserts, ...sqlStatements];

// Generate migration file
const migrationContent = allStatements.join('\n');

console.log(`\nGenerated ${allStatements.length} SQL statements:`);
console.log(`  - Venues: ${venueInserts.length}`);
console.log(`  - Crew: ${crewInserts.length}`);
console.log(`  - Equipment: ${equipmentMap.size}`);
console.log(`  - Items: ${itemId - 1}`);

// Output for manual review or piping to database
console.log('\n=== SQL MIGRATION ===\n');
console.log(migrationContent);

// Optionally save to file for later
const outputFile = path.join(__dirname, '../../database/migrations/001_initial_data.sql');
fs.writeFileSync(outputFile, migrationContent);
console.log(`\nMigration saved to: ${outputFile}`);
console.log('\nTo apply this migration to Cloudflare D1:');
console.log('  npx wrangler d1 execute sound-inventory-dev --file database/migrations/001_initial_data.sql');
