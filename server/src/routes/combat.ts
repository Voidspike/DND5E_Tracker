import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const mapIdParamSchema = z.object({
  mapId: z.string().min(1),
});

// Get active/paused combat for a map
router.get('/map/:mapId/active', authenticate, async (req: Request, res: Response) => {
  const { mapId } = mapIdParamSchema.parse(req.params);
  const combat = await prisma.combatTracker.findFirst({
    where: { mapId, status: { in: ['setup', 'active', 'paused'] } },
    include: { participants: true },
  });
  res.json(combat || null);
});

// Get combat history (completed) for a map
router.get('/map/:mapId/history', authenticate, async (req: Request, res: Response) => {
  const { mapId } = mapIdParamSchema.parse(req.params);
  const combats = await prisma.combatTracker.findMany({
    where: { mapId, status: 'completed' },
    include: { participants: true },
    orderBy: { endedAt: 'desc' },
  });
  res.json(combats);
});

export default router;
