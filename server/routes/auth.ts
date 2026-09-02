import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  // For the MVP, accept any standard test login or admin@emailops.io
  const user = db.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase()) || db.users[0];

  res.json({
    success: true,
    token: 'jwt_mock_emailops_session_token_xyz890',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

authRouter.get('/me', (req: Request, res: Response) => {
  const user = db.users[0];
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});
