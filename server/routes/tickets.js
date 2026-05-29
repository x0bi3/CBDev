import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';

const router = Router();

function mapTicket(row) {
  return {
    id: row.id,
    email: row.email,
    contactName: row.contact_name,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    clientId: row.client_id,
    contactPref: row.contact_pref,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    createdAt: row.created_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    sender: row.sender,
    body: row.body,
    createdAt: row.created_at,
  };
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const subject = String(req.body.subject || req.body.title || '').trim();
    const message = String(req.body.message || req.body.description || '').trim();
    let email = String(req.body.email || req.body.contactEmail || '').trim().toLowerCase();
    const category = String(req.body.category || 'Website update').trim();
    const priority = String(req.body.priority || 'Normal').trim();
    const clientId = req.body.clientId ? String(req.body.clientId).trim() : null;
    const contactPref = String(req.body.contactPref || req.body.pref || 'Email').trim();
    const contactEmail = req.body.contactEmail ? String(req.body.contactEmail).trim().toLowerCase() : null;
    const contactPhone = req.body.contactPhone ? String(req.body.contactPhone).trim() : null;
    const userId = req.userId || null;
    let contactName = String(req.body.contactName || req.body.name || '').trim();

    if (userId && !contactName) {
      const { rows: users } = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
      if (users[0]) {
        contactName = users[0].name;
        if (!email) email = users[0].email;
      }
    }

    if (!subject) {
      res.status(400).json({ error: 'Subject required' });
      return;
    }
    if (!message) {
      res.status(400).json({ error: 'Description required' });
      return;
    }
    if (!userId) {
      if (!contactName) {
        res.status(400).json({ error: 'Name required' });
        return;
      }
      if (!email && !contactPhone) {
        res.status(400).json({ error: 'Email or phone number required' });
        return;
      }
    }
    if (!email && contactPhone) {
      email = `ticket+${contactPhone.replace(/\D/g, '')}@tickets.creativebuilds.dev`;
    }
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    const ticketPriority = userId ? priority : 'Normal';

    const { rows } = await query(
      `INSERT INTO support_tickets
         (user_id, email, contact_name, subject, category, priority, client_id, contact_pref, contact_email, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email, contact_name, subject, category, priority, status, client_id, contact_pref, contact_email, contact_phone, created_at`,
      [userId, email, contactName || null, subject, category, ticketPriority, clientId, contactPref,
        contactEmail || (email.includes('@tickets.creativebuilds.dev') ? null : email), contactPhone],
    );
    const ticket = rows[0];
    await query(
      `INSERT INTO ticket_messages (ticket_id, sender, body) VALUES ($1, 'user', $2)`,
      [ticket.id, message],
    );

    res.status(201).json({ ticket: mapTicket(ticket) });
  } catch (err) {
    console.error('tickets create:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, contact_name, subject, category, priority, status, client_id, contact_pref, contact_email, contact_phone, created_at
       FROM support_tickets WHERE user_id = $1 OR email = $2
       ORDER BY created_at DESC`,
      [req.userId, req.userEmail],
    );
    res.json({ tickets: rows.map(mapTicket) });
  } catch (err) {
    console.error('tickets list:', err);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { rows } = await query(
      `SELECT id, email, contact_name, subject, category, priority, status, client_id, contact_pref, contact_email, contact_phone, created_at
       FROM support_tickets
       WHERE id = $1 AND (user_id = $2 OR email = $3)`,
      [ticketId, req.userId, req.userEmail],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const { rows: messages } = await query(
      `SELECT id, sender, body, created_at FROM ticket_messages
       WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticketId],
    );
    res.json({ ticket: mapTicket(rows[0]), messages: messages.map(mapMessage) });
  } catch (err) {
    console.error('tickets get:', err);
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const body = String(req.body.body || req.body.message || '').trim();
    if (!body) {
      res.status(400).json({ error: 'Message required' });
      return;
    }

    const { rows: tickets } = await query(
      `SELECT id FROM support_tickets WHERE id = $1 AND (user_id = $2 OR email = $3)`,
      [ticketId, req.userId, req.userEmail],
    );
    if (!tickets[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const { rows } = await query(
      `INSERT INTO ticket_messages (ticket_id, sender, body) VALUES ($1, 'user', $2)
       RETURNING id, sender, body, created_at`,
      [ticketId, body],
    );
    res.status(201).json({ message: mapMessage(rows[0]) });
  } catch (err) {
    console.error('tickets message:', err);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

export default router;
