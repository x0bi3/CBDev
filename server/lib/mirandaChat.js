/**
 * Miranda live chat persistence (threads + messages).
 */
import { query } from '../db.js';

export const OPENING_TEXT =
  "Hi — I'm Miranda, Ryan's virtual assistant at CreativeBuilds. I can help with pricing, scoping a project, or Free Service Audits. If you need to get a hold of Ryan directly, I can see if he's available for a live chat. What are you working on?";

function mapThread(row) {
  if (!row) return null;
  return {
    id: row.id,
    visitorToken: row.visitor_token,
    status: row.status,
    title: row.title,
    visitorName: row.visitor_name,
    visitorEmail: row.visitor_email,
    requestedLiveAt: row.requested_live_at,
    claimedAt: row.claimed_at,
    claimedBy: row.claimed_by,
    closedAt: row.closed_at,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function touchThread(threadId) {
  await query(
    `UPDATE miranda_chat_threads SET last_message_at = now(), updated_at = now() WHERE id = $1`,
    [threadId],
  );
}

export async function createThread({ visitorToken, title = 'New conversation' }) {
  const { rows } = await query(
    `INSERT INTO miranda_chat_threads (visitor_token, title)
     VALUES ($1, $2)
     RETURNING *`,
    [visitorToken, title],
  );
  const thread = mapThread(rows[0]);
  await insertMessage({ threadId: thread.id, role: 'miranda', body: OPENING_TEXT });
  return thread;
}

export async function getThreadById(id) {
  const { rows } = await query(`SELECT * FROM miranda_chat_threads WHERE id = $1`, [id]);
  return mapThread(rows[0]);
}

export async function getThreadForVisitor(id, visitorToken) {
  const { rows } = await query(
    `SELECT * FROM miranda_chat_threads WHERE id = $1 AND visitor_token = $2`,
    [id, visitorToken],
  );
  return mapThread(rows[0]);
}

export async function insertMessage({ threadId, role, body }) {
  const text = String(body || '').trim();
  if (!text) return null;
  const { rows } = await query(
    `INSERT INTO miranda_chat_messages (thread_id, role, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [threadId, role, text],
  );
  await touchThread(threadId);
  return mapMessage(rows[0]);
}

export async function listMessages(threadId, sinceId = 0) {
  const { rows } = await query(
    `SELECT * FROM miranda_chat_messages
     WHERE thread_id = $1 AND id > $2
     ORDER BY created_at ASC`,
    [threadId, Number(sinceId) || 0],
  );
  return rows.map(mapMessage);
}

export async function listAllMessages(threadId) {
  const { rows } = await query(
    `SELECT * FROM miranda_chat_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId],
  );
  return rows.map(mapMessage);
}

export async function updateThreadTitle(threadId, title) {
  if (!title) return;
  await query(
    `UPDATE miranda_chat_threads SET title = $1, updated_at = now() WHERE id = $2`,
    [String(title).slice(0, 200), threadId],
  );
}

export async function setVisitorInfo(threadId, { name, email }) {
  await query(
    `UPDATE miranda_chat_threads
     SET visitor_name = COALESCE($1, visitor_name),
         visitor_email = COALESCE($2, visitor_email),
         updated_at = now()
     WHERE id = $3`,
    [name || null, email || null, threadId],
  );
}

export async function requestLiveChat(threadId, { name, email } = {}) {
  if (name || email) await setVisitorInfo(threadId, { name, email });
  const { rows } = await query(
    `UPDATE miranda_chat_threads
     SET status = 'awaiting_ryan',
         requested_live_at = COALESCE(requested_live_at, now()),
         updated_at = now()
     WHERE id = $1 AND status IN ('bot', 'awaiting_ryan')
     RETURNING *`,
    [threadId],
  );
  return mapThread(rows[0]);
}

export async function claimThread(threadId, claimedBy = 'ryan') {
  const { rows } = await query(
    `UPDATE miranda_chat_threads
     SET status = 'live',
         claimed_at = now(),
         claimed_by = $2,
         updated_at = now()
     WHERE id = $1 AND status IN ('awaiting_ryan', 'bot')
     RETURNING *`,
    [threadId, claimedBy],
  );
  return mapThread(rows[0]);
}

export async function releaseToMiranda(threadId) {
  const { rows } = await query(
    `UPDATE miranda_chat_threads
     SET status = 'bot',
         claimed_at = NULL,
         claimed_by = NULL,
         updated_at = now()
     WHERE id = $1 AND status = 'live'
     RETURNING *`,
    [threadId],
  );
  return mapThread(rows[0]);
}

export async function closeThread(threadId) {
  const { rows } = await query(
    `UPDATE miranda_chat_threads
     SET status = 'closed',
         closed_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [threadId],
  );
  return mapThread(rows[0]);
}

export async function listThreadsAdmin({ status } = {}) {
  const params = [];
  let where = '';
  if (status && status !== 'all') {
    params.push(status);
    where = `WHERE status = $1`;
  }
  const { rows } = await query(
    `SELECT t.*,
       (SELECT body FROM miranda_chat_messages m
        WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview
     FROM miranda_chat_threads t
     ${where}
     ORDER BY
       CASE t.status
         WHEN 'awaiting_ryan' THEN 0
         WHEN 'live' THEN 1
         WHEN 'bot' THEN 2
         ELSE 3
       END,
       t.last_message_at DESC
     LIMIT 200`,
    params,
  );
  return rows.map((r) => ({ ...mapThread(r), lastPreview: r.last_preview || '' }));
}

export async function countAwaitingThreads() {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM miranda_chat_threads WHERE status = 'awaiting_ryan'`,
  );
  return rows[0]?.n || 0;
}

export async function logNotification({ threadId, channel, status, providerId, error }) {
  await query(
    `INSERT INTO miranda_chat_notifications (thread_id, channel, status, provider_id, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [threadId, channel, status, providerId || null, error || null],
  );
}

export function titleFromFirstMessage(text) {
  const t = String(text || '').trim();
  if (!t) return 'New conversation';
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

export function uiRoleFromDb(role) {
  if (role === 'visitor') return 'user';
  if (role === 'miranda' || role === 'ryan' || role === 'system') return 'assistant';
  return 'assistant';
}

export function dbRoleFromUi(role, asRyan = false) {
  if (asRyan) return 'ryan';
  if (role === 'user') return 'visitor';
  return 'miranda';
}
