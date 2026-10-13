/**
 * GHT Discovery Board – Google Sheets + Drive storage
 * Quantum Build Consultancy Ltd
 *
 * Setup (once):
 *  1. Create a Google Sheet (e.g. "GHT Discovery"). Extensions → Apps Script.
 *  2. Paste this file as Code.gs. Save.
 *  3. Run `setup` once (Run ▶, approve the permissions). The execution log
 *     prints the ACCESS KEY. Keep it private.
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     Copy the Web app URL (ends in /exec).
 *  5. In the Discovery Board press "Connect Google Sheet", paste the URL and key.
 *
 * Data: sheet "Items" (notes, files, voice notes, build items), sheet "Meta"
 * (status, ticked questions, answers per module). Files go in a Drive folder
 * "GHT Discovery Files" with a subfolder per module.
 * After editing this code: Deploy → Manage deployments → Edit → New version.
 */

const ITEM_COLS = ['id','mod','q','kind','tag','text','done','author','createdAt','fileName','contentType','fileId','seconds','updatedAt'];
const META_COLS = ['mod','status','asked','answers','updatedAt'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'Items', ITEM_COLS);
  ensureSheet_(ss, 'Meta', META_COLS);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    const folder = DriveApp.createFolder('GHT Discovery Files');
    props.setProperty('FOLDER_ID', folder.getId());
  }
  if (!props.getProperty('KEY')) {
    props.setProperty('KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  }
  Logger.log('ACCESS KEY: ' + props.getProperty('KEY'));
  Logger.log('Files folder: https://drive.google.com/drive/folders/' + props.getProperty('FOLDER_ID'));
}

/** Run to issue a new key (everyone must re-connect with it). */
function rotateKey() {
  const k = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  PropertiesService.getScriptProperties().setProperty('KEY', k);
  Logger.log('NEW ACCESS KEY: ' + k);
}

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  return handle_(body);
}

function handle_(p) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('KEY');
    if (!key || p.key !== key) return out_({ ok: false, error: 'bad_key' });
    switch (p.action) {
      case 'ping': return out_({ ok: true });
      case 'all': return out_(Object.assign({ ok: true }, readAll_()));
      case 'putItem': return withLock_(() => out_({ ok: true, item: putItem_(p.item, p.file) }));
      case 'deleteItem': return withLock_(() => out_({ ok: deleteItem_(p.id) }));
      case 'patchMeta': return withLock_(() => out_({ ok: true, meta: patchMeta_(p.mod, p.patch || {}) }));
      case 'file': return out_(Object.assign({ ok: true }, readFile_(p.fileId)));
      default: return out_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

// ---------- reads ----------
function readAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const items = rows_(ss.getSheetByName('Items'), ITEM_COLS).map(r => ({
    id: String(r.id), mod: String(r.mod), q: r.q === '' ? null : Number(r.q), kind: String(r.kind),
    tag: String(r.tag || ''), text: String(r.text || ''), done: r.done === true || r.done === 'TRUE' || r.done === 'true',
    author: String(r.author || ''), createdAt: String(r.createdAt || ''), fileName: String(r.fileName || ''),
    contentType: String(r.contentType || ''), fileId: String(r.fileId || ''), seconds: r.seconds === '' ? null : Number(r.seconds)
  }));
  const meta = {};
  rows_(ss.getSheetByName('Meta'), META_COLS).forEach(r => {
    meta[String(r.mod)] = { status: Number(r.status) || 0, asked: parse_(r.asked), answers: parse_(r.answers) };
  });
  return { items: items, meta: meta };
}

function readFile_(fileId) {
  const blob = DriveApp.getFileById(String(fileId)).getBlob();
  return { name: blob.getName(), type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- writes ----------
function putItem_(item, file) {
  if (!item || !item.id || !item.mod) throw new Error('missing id or module');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Items');
  const rowIx = findRow_(sh, item.id);
  if (file && file.data && !item.fileId) {
    const bytes = Utilities.base64Decode(file.data);
    if (bytes.length > MAX_FILE_BYTES) throw new Error('file_too_large');
    const blob = Utilities.newBlob(bytes, file.type || 'application/octet-stream', file.name || 'file');
    item.fileId = moduleFolder_(item.mod).createFile(blob).getId();
  }
  item.updatedAt = new Date().toISOString();
  const row = ITEM_COLS.map(c => cell_(item[c]));
  if (rowIx) sh.getRange(rowIx, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return { id: item.id, fileId: item.fileId || '' };
}

function deleteItem_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Items');
  const rowIx = findRow_(sh, id);
  if (!rowIx) return true;
  const fileId = sh.getRange(rowIx, ITEM_COLS.indexOf('fileId') + 1).getValue();
  if (fileId) { try { DriveApp.getFileById(String(fileId)).setTrashed(true); } catch (e) {} }
  sh.deleteRow(rowIx);
  return true;
}

function patchMeta_(mod, patch) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meta');
  const rowIx = findRow_(sh, mod);
  let cur = { status: 0, asked: {}, answers: {} };
  if (rowIx) {
    const v = sh.getRange(rowIx, 1, 1, META_COLS.length).getValues()[0];
    cur = { status: Number(v[1]) || 0, asked: parse_(v[2]), answers: parse_(v[3]) };
  }
  if (patch.status !== undefined) cur.status = Number(patch.status) || 0;
  if (patch.asked) Object.keys(patch.asked).forEach(k => { cur.asked[k] = !!patch.asked[k]; });
  if (patch.answers) Object.keys(patch.answers).forEach(k => { cur.answers[k] = String(patch.answers[k]); });
  const row = [cell_(mod), cur.status, cell_(JSON.stringify(cur.asked)), cell_(JSON.stringify(cur.answers)), cell_(new Date().toISOString())];
  if (rowIx) sh.getRange(rowIx, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return cur;
}

// ---------- helpers ----------
function ensureSheet_(ss, name, cols) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(cols);
  sh.setFrozenRows(1);
  return sh;
}
function rows_(sh, cols) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map(v => {
    const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o;
  }).filter(r => r[cols[0]] !== '');
}
function findRow_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function moduleFolder_(mod) {
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const it = root.getFoldersByName(mod);
  return it.hasNext() ? it.next() : root.createFolder(mod);
}
// Store text as literal text so Sheets never turns it into a formula or a date.
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  return "'" + String(v);
}
function parse_(s) { try { return s ? JSON.parse(String(s)) : {}; } catch (e) { return {}; } }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
