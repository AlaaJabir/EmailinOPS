import { Router, Request, Response } from 'express';
import { convexService } from '../services/ConvexService.js';
import { optionalAuth } from '../middleware/auth.js';

export const templatesRouter = Router();
templatesRouter.use(optionalAuth);

templatesRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const templates = await convexService.getTemplates(userId);
  res.json({ templates });
});

templatesRouter.post('/', async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const {
    name,
    subject = '',
    preheader = '',
    headHtml = '',
    htmlBody = '',
    plainText = '',
    variables = [],
    fromName,
    fromEmail,
    replyTo,
    customHeaders = {},
    trackOpens = true,
    trackClicks = true,
    isMarketing = false,
  } = req.body || {};

  if (!String(name || '').trim()) return res.status(400).json({ error: 'Template name is required' });
  if (!String(htmlBody || '').trim() && !String(plainText || '').trim()) {
    return res.status(400).json({ error: 'Template must contain HTML or plain-text content' });
  }

  const template = await convexService.saveTemplate(
    {
      name: String(name).trim(),
      subject: String(subject),
      preheader: String(preheader),
      headHtml: String(headHtml),
      htmlBody: String(htmlBody),
      plainText: String(plainText),
      variables: Array.isArray(variables) ? variables.map(String) : [],
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
      replyTo: replyTo || undefined,
      customHeaders: customHeaders || {},
      trackOpens: Boolean(trackOpens),
      trackClicks: Boolean(trackClicks),
      isMarketing: Boolean(isMarketing),
    },
    userId
  );

  res.status(201).json({ template });
});

templatesRouter.put('/:id', async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const template = await convexService.updateTemplate(req.params.id, req.body || {}, userId);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json({ template });
});

templatesRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  await convexService.deleteTemplate(req.params.id, userId);
  res.json({ success: true, templateId: req.params.id });
});
