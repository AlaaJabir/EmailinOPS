import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { Contact, ContactList } from '../../src/types.js';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const contactsRouter = Router();

// GET /api/contacts - List contacts with filter & search (scoped to user)
contactsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { search, status, listId } = req.query;
  let list: Contact[] = [];
  if (req.user && supabaseService.isConfigured) {
    list = await supabaseService.getContacts(req.user.id);
  } else {
    list = [...db.contacts];
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.firstName && c.firstName.toLowerCase().includes(q)) ||
        (c.lastName && c.lastName.toLowerCase().includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q))
    );
  }

  if (status && typeof status === 'string' && status !== 'ALL') {
    list = list.filter((c) => c.status === status);
  }

  res.json({ contacts: list });
});

// POST /api/contacts - Add single contact
contactsRouter.post('/', (req: Request, res: Response) => {
  const { email, firstName, lastName, company, tags, listId } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const existing = db.contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Contact already exists' });
  }

  const newContact: Contact = {
    id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: email.toLowerCase(),
    firstName,
    lastName,
    company,
    tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.contacts.unshift(newContact);

  if (listId) {
    db.listMemberships.push({
      listId,
      contactId: newContact.id,
      joinedAt: new Date().toISOString(),
    });
    const targetList = db.contactLists.find((l) => l.id === listId);
    if (targetList) targetList.memberCount += 1;
  }

  res.json({ success: true, contact: newContact });
});

// POST /api/contacts/import - Import CSV contacts
contactsRouter.post('/import', (req: Request, res: Response) => {
  const { contacts, listId } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Valid array of contacts required' });
  }

  let imported = 0;
  let skippedSuppressed = 0;
  let skippedDuplicates = 0;

  for (const item of contacts) {
    if (!item.email || !item.email.includes('@')) continue;
    const emailNorm = item.email.toLowerCase().trim();

    // Check suppression
    if (db.suppressions.some((s) => s.email.toLowerCase() === emailNorm)) {
      skippedSuppressed++;
      continue;
    }

    // Check duplicate
    if (db.contacts.some((c) => c.email.toLowerCase() === emailNorm)) {
      skippedDuplicates++;
      continue;
    }

    const newContact: Contact = {
      id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: emailNorm,
      firstName: item.firstName || item.name?.split(' ')[0],
      lastName: item.lastName || item.name?.split(' ').slice(1).join(' '),
      company: item.company,
      tags: item.tags ? (Array.isArray(item.tags) ? item.tags : [item.tags]) : ['csv-import'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.contacts.unshift(newContact);
    imported++;

    if (listId) {
      db.listMemberships.push({
        listId,
        contactId: newContact.id,
        joinedAt: new Date().toISOString(),
      });
    }
  }

  if (listId) {
    const targetList = db.contactLists.find((l) => l.id === listId);
    if (targetList) targetList.memberCount += imported;
  }

  db.logs.unshift({
    id: `log_imp_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    event: 'CSV_CONTACT_IMPORT_COMPLETED',
    severity: 'INFO',
    response: `Imported ${imported} clean contacts (Skipped ${skippedSuppressed} suppressed, ${skippedDuplicates} duplicates)`,
  });

  res.json({
    success: true,
    imported,
    skippedSuppressed,
    skippedDuplicates,
    totalReceived: contacts.length,
  });
});

// GET /api/contacts/lists - Get all contact lists
contactsRouter.get('/lists', (req: Request, res: Response) => {
  res.json({ lists: db.contactLists });
});

// POST /api/contacts/lists - Create contact list
contactsRouter.post('/lists', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const newList: ContactList = {
    id: `lst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    description,
    memberCount: 0,
    createdAt: new Date().toISOString(),
  };

  db.contactLists.unshift(newList);
  res.json({ success: true, list: newList });
});
