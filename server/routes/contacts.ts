import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { db } from '../store.js';
import { convexService } from '../services/ConvexService.js';

export const contactsRouter = Router();

contactsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    let contacts = await convexService.getContacts(userId);
    const { search, status, listId } = req.query;

    if (listId && typeof listId === 'string') {
      const contactIds = new Set(
        db.listMemberships.filter((m) => m.listId === listId).map((m) => m.contactId)
      );
      contacts = contacts.filter((c) => contactIds.has(c.id));
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      contacts = contacts.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.firstName?.toLowerCase().includes(q) ||
          c.lastName?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
      );
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      contacts = contacts.filter((c) => c.status === status);
    }
    return res.json({ contacts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

contactsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  const { email, firstName, lastName, company, tags, listId } = req.body;
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return res.status(400).json({ error: 'Valid email is required' });

  const userId = req.user?.id || await convexService.getDefaultUserId();
  const existing = (await convexService.getContacts(userId)).find((c) => c.email.toLowerCase() === normalized);
  if (existing) return res.status(409).json({ error: 'Contact already exists' });

  const contact = await convexService.saveContact(
    {
      email: normalized,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      company: company || undefined,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
      status: 'ACTIVE',
    },
    userId
  );

  if (listId) {
    db.listMemberships.push({
      listId: String(listId),
      contactId: contact.id,
      joinedAt: new Date().toISOString(),
    });
  }

  return res.status(201).json({ success: true, contact });
});

contactsRouter.post('/import', optionalAuth, async (req: Request, res: Response) => {
  const { contacts, listId } = req.body;
  if (!Array.isArray(contacts) || !contacts.length) return res.status(400).json({ error: 'Valid array of contacts required' });

  const userId = req.user?.id || await convexService.getDefaultUserId();
  const suppressions = await convexService.getSuppressions(userId);
  const suppressedSet = new Set(suppressions.map((s) => s.email.toLowerCase()));

  const existingContacts = await convexService.getContacts(userId);
  const existingMap = new Map(existingContacts.map((c) => [c.email.toLowerCase(), c.id]));

  let imported = 0;
  let skippedSuppressed = 0;
  let skippedDuplicates = 0;
  let assignedToList = 0;

  for (const item of contacts) {
    const email = String(item?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;

    if (suppressedSet.has(email)) {
      skippedSuppressed++;
      continue;
    }

    if (existingMap.has(email)) {
      skippedDuplicates++;
      if (listId) {
        const contactId = existingMap.get(email)!;
        db.listMemberships.push({ listId: String(listId), contactId, joinedAt: new Date().toISOString() });
        assignedToList++;
      }
      continue;
    }

    const saved = await convexService.saveContact(
      {
        email,
        firstName: item.firstName || item.name?.split(' ')[0] || undefined,
        lastName: item.lastName || item.name?.split(' ').slice(1).join(' ') || undefined,
        company: item.company || undefined,
        tags: item.tags ? (Array.isArray(item.tags) ? item.tags : [item.tags]) : ['csv-import'],
        status: 'ACTIVE',
      },
      userId
    );
    existingMap.set(email, saved.id);
    imported++;

    if (listId) {
      db.listMemberships.push({ listId: String(listId), contactId: saved.id, joinedAt: new Date().toISOString() });
      assignedToList++;
    }
  }

  return res.json({
    success: true,
    imported,
    assignedToList,
    skippedSuppressed,
    skippedDuplicates,
    totalReceived: contacts.length,
  });
});

contactsRouter.get('/lists', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const lists = await convexService.getContactLists(userId);
  return res.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      memberCount: db.listMemberships.filter((m) => m.listId === l.id).length,
      createdAt: l.createdAt,
      updatedAt: l.createdAt,
    })),
  });
});

contactsRouter.post('/lists', optionalAuth, async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const now = new Date().toISOString();
  const newList = {
    id: `lst_${Date.now()}`,
    name: String(name).trim(),
    description: description || undefined,
    memberCount: 0,
    createdAt: now,
  };
  db.contactLists.push(newList);

  return res.status(201).json({
    success: true,
    list: {
      id: newList.id,
      name: newList.name,
      description: newList.description,
      memberCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  });
});
