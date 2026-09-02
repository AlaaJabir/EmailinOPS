import { Router, Request, Response } from 'express';
import { kumoMtaService } from '../services/KumoMtaService.js';
import { db } from '../store.js';

export const seedRouter = Router();

// POST /api/seed/simulate-traffic - Dispatches a live batch of simulated emails
seedRouter.post('/simulate-traffic', async (req: Request, res: Response) => {
  const count = Number(req.body.count) || 5;

  const mockUsers = [
    { name: 'Dr. Liam Neeson', email: `liam.${Date.now()}@action-cloud.com` },
    { name: 'Sarah Connor', email: `sarah.t800.${Date.now()}@cyberdyne.org` },
    { name: 'Alex Vance', email: `alex.${Date.now()}@black-mesa.gov` },
    { name: 'Invalid User', email: `bounced.user.${Date.now()}@deadbox.xyz` },
    { name: 'Dr. Ellie Sattler', email: `ellie.paleo.${Date.now()}@ingen-isla.cr` },
  ];

  const results = [];
  const sender = db.senders[Math.floor(Math.random() * db.senders.length)];

  for (let i = 0; i < Math.min(count, mockUsers.length); i++) {
    const target = mockUsers[i];
    const resSend = await kumoMtaService.submitEmail({
      fromName: sender.name,
      fromEmail: sender.fromEmail,
      to: target.email,
      subject: `Live Traffic Stream Event #${Math.floor(Math.random() * 9000 + 1000)}`,
      htmlBody: `<p>Real-time queue verification test for recipient <strong>${target.name}</strong>.</p>`,
    });
    results.push(resSend);
  }

  res.json({
    success: true,
    count: results.length,
    results,
  });
});
