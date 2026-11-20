// 为「幻想还是现实？」项目在独立剧本库(kind=scripts)里创建一条归属记录
// 用法：node scripts/fill-fantasy-script.mjs
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const DB = new URL('../server/data/tasks.db', import.meta.url);
const db = new DatabaseSync(DB.pathname);

const PROJECT_ID = 'e98a364e-96a5-4702-a060-eedcb844e975';

const projRow = db.prepare('SELECT org_id, created_by, data FROM documents WHERE id = ?').get(PROJECT_ID);
if (!projRow) {
  console.error('项目不存在：', PROJECT_ID);
  process.exit(1);
}
const proj = JSON.parse(projRow.data);
const content = proj.script?.excerpt || '';

if (!content.trim()) {
  console.error('项目内嵌剧本为空，无法创建剧本库记录');
  process.exit(1);
}

// 若已存在归属该项目的剧本，先删除避免重复
const existing = db.prepare("SELECT id FROM documents WHERE kind='scripts' AND id IN (SELECT id FROM documents WHERE kind='scripts')").all();
const linked = existing.filter(r => {
  const d = JSON.parse(db.prepare('SELECT data FROM documents WHERE id=?').get(r.id).data);
  return d.projectId === PROJECT_ID;
});
for (const r of linked) {
  db.prepare('DELETE FROM documents WHERE id=?').run(r.id);
  console.log('已清理旧记录：', r.id);
}

const id = randomUUID();
const now = Date.now();
const payload = {
  title: '幻想还是现实？',
  source: '原创',
  fileName: '',
  chars: content.replace(/\s+/g, '').length,
  scenes: content.split(/\n(?=\s*第[一二三四五六七八九十百零两\d]+[幕场集回])/).filter(p => p.trim()).length || 3,
  excerpt: content.replace(/\s+/g, ' ').slice(0, 72),
  content,
  projectId: PROJECT_ID,
};

db.prepare('INSERT INTO documents (id, kind, data, created_at, updated_at, org_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(id, 'scripts', JSON.stringify(payload), now, now, projRow.org_id, projRow.created_by);

console.log('✅ 已创建归属剧本记录：', id);
console.log('   title:', payload.title);
console.log('   projectId:', payload.projectId);
console.log('   chars:', payload.chars, '/ scenes:', payload.scenes);
