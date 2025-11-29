const db = require("better-sqlite3")("db.sqlite3");

console.log("數據庫表列表:");
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();

tables.forEach((t) => {
  console.log(`\n📋 ${t.name}:`);
  const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
  cols.forEach((c) => {
    const pk = c.pk ? " [PK]" : "";
    const nullable = c.notnull ? "" : " [NULL]";
    console.log(`  - ${c.name} (${c.type})${pk}${nullable}`);
  });
});

db.close();
