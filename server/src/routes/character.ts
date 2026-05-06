import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const createSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1).max(100),
  class: z.string().min(1).max(50),
  race: z.string().min(1).max(50),
  stats: z.object({
    str: z.number().int().min(1).max(30),
    dex: z.number().int().min(1).max(30),
    con: z.number().int().min(1).max(30),
    int: z.number().int().min(1).max(30),
    wis: z.number().int().min(1).max(30),
    cha: z.number().int().min(1).max(30),
  }),
  hpMax: z.number().int().positive(),
  ac: z.number().int().positive(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  class: z.string().min(1).max(50).optional(),
  level: z.number().int().positive().optional(),
  race: z.string().min(1).max(50).optional(),
  hpCurrent: z.number().int().optional(),
  hpMax: z.number().int().positive().optional(),
  tempHp: z.number().int().optional(),
  ac: z.number().int().positive().optional(),
  stats: z.object({
    str: z.number().int().min(1).max(30),
    dex: z.number().int().min(1).max(30),
    con: z.number().int().min(1).max(30),
    int: z.number().int().min(1).max(30),
    wis: z.number().int().min(1).max(30),
    cha: z.number().int().min(1).max(30),
  }).optional(),
  skills: z.record(z.number()).optional(),
  notes: z.string().optional(),
});

// Get characters for a campaign
router.get('/campaign/:campaignId', authenticate, async (req: Request, res: Response) => {
  const characters = await prisma.character.findMany({
    where: { campaignId: req.params.campaignId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(characters);
});

// Get own characters
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const characters = await prisma.character.findMany({
    where: { userId: req.user!.userId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(characters);
});

// Create character
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    const character = await prisma.character.create({
      data: {
        userId: req.user!.userId,
        campaignId: data.campaignId,
        name: data.name,
        class: data.class,
        race: data.race,
        hpCurrent: data.hpMax,
        hpMax: data.hpMax,
        ac: data.ac,
        stats: JSON.stringify(data.stats),
      },
    });
    res.status(201).json(character);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create character error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update character
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const character = await prisma.character.findUnique({ where: { id: req.params.id } });
    if (!character) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }
    if (character.userId !== req.user!.userId) {
      res.status(403).json({ error: 'You can only edit your own characters' });
      return;
    }

    const data = updateSchema.parse(req.body);
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.class) updateData.class = data.class;
    if (data.level) updateData.level = data.level;
    if (data.race) updateData.race = data.race;
    if (data.hpCurrent !== undefined) updateData.hpCurrent = data.hpCurrent;
    if (data.hpMax !== undefined) updateData.hpMax = data.hpMax;
    if (data.tempHp !== undefined) updateData.tempHp = data.tempHp;
    if (data.ac !== undefined) updateData.ac = data.ac;
    if (data.stats) updateData.stats = JSON.stringify(data.stats);
    if (data.skills) updateData.skills = JSON.stringify(data.skills);
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.character.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update character error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
