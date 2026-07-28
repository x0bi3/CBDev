import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Apply additive migrations that are safe to re-run (IF NOT EXISTS). */
export async function ensureLeadAutomationSchema() {
  const files = [
    '024_recon_and_cal.sql',
    '025_quote_promo.sql',
    '026_content_engine.sql',
    '028_free_service_audits.sql',
    '029_free_audit_expires.sql',
    '030_miranda_chat.sql',
  ];
  for (const name of files) {
    const sqlPath = resolve(__dirname, '../sql', name);
    const sql = readFileSync(sqlPath, 'utf8');
    await query(sql);
    console.log(`ensure-schema: applied ${name}`);
  }
}
