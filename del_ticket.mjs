import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const id = process.argv[2];
const action = process.argv[3];
const rows = await sql`select id, title, status, created_at from tickets where id = ${id}`;
console.log('FOUND:', JSON.stringify(rows, null, 2));
if (action === 'delete' && rows.length) {
  const del = await sql`delete from tickets where id = ${id} returning id`;
  console.log('DELETED:', JSON.stringify(del));
}
await sql.end();
