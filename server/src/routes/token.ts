import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const createSchema = z.object({
  mapId: z.string().uuid(),
  type: z.enum(['character', 'npc', 'monster', 'object']),
  name: z.string().min(1).max(100),
  x: z.number().default(0),
  y: z.number().default(0),
  ownerId: z.string().uuid().optional(),
  imageUrl: z.string().optional(),
  color: z.string().default('#ffffff'),
  hpCurrent: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  ac: z.number().int().optional(),
  darkvision: z.number().int().optional(),
  speed: z.number().int().optional(),
  characterId: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  type: z.enum(['character', 'npc', 'monster', 'object']).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  color: z.string().optional(),
  hpCurrent: z.number().int().nullable().optional(),
  hpMax: z.number().int().nullable().optional(),
  ac: z.number().int().nullable().optional(),
  darkvision: z.number().int().nullable().optional(),
  speed: z.number().int().nullable().optional(),
  isHidden: z.boolean().optional(),
  statusEffects: z.array(z.string()).optional(),
  characterId: z.string().uuid().nullable().optional(),
});

// Get tokens for a campaign
router.get('/campaign/:campaignId', authenticate, async (req: Request, res: Response) => {
  const tokens = await prisma.token.findMany({
    where: { campaignId: req.params.campaignId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(tokens);
});

// Get tokens for a map
router.get('/map/:mapId', authenticate, async (req: Request, res: Response) => {
  const tokens = await prisma.token.findMany({
    where: { mapId: req.params.mapId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(tokens);
});

// Create token
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const map = await prisma.map.findUnique({ where: { id: data.mapId } });
    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    const token = await prisma.token.create({
      data: {
        mapId: data.mapId,
        campaignId: map.campaignId,
        type: data.type,
        name: data.name,
        x: data.x,
        y: data.y,
        ownerId: data.ownerId || null,
        imageUrl: data.imageUrl || null,
        color: data.color,
        hpCurrent: data.hpCurrent || null,
        hpMax: data.hpMax || null,
        ac: data.ac || null,
        characterId: data.characterId || null,
      },
    });
    res.status(201).json(token);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update token
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const token = await prisma.token.findUnique({ where: { id: req.params.id } });
    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    const data = updateSchema.parse(req.body);
    const statusEffects = data.statusEffects !== undefined ? JSON.stringify(data.statusEffects) : undefined;

    const updated = await prisma.token.update({
      where: { id: req.params.id },
      data: { ...data, statusEffects },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete token
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const token = await prisma.token.findUnique({ where: { id: req.params.id } });
  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }
  await prisma.token.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
