import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  imageUrl: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().default(50),
  gridColor: z.string().optional(),
  gridLineWidth: z.number().int().min(1).max(5).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().optional(),
  gridOffsetX: z.number().int().optional(),
  gridOffsetY: z.number().int().optional(),
  gridColor: z.string().optional(),
  gridLineWidth: z.number().int().min(1).max(5).optional(),
});

// Get maps for a campaign
router.get('/campaign/:campaignId', authenticate, async (req: Request, res: Response) => {
  const maps = await prisma.map.findMany({
    where: { campaignId: req.params.campaignId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(maps);
});

// Create map
router.post('/campaign/:campaignId', authenticate, async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.campaignId } });
    if (!campaign || campaign.dmId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the DM can create maps' });
      return;
    }

    const data = createSchema.parse(req.body);
    const map = await prisma.map.create({
      data: {
        campaignId: req.params.campaignId,
        name: data.name,
        imageUrl: data.imageUrl,
        width: data.width || 0,
        height: data.height || 0,
        gridSize: data.gridSize,
        gridColor: data.gridColor,
        gridLineWidth: data.gridLineWidth,
      },
    });
    res.status(201).json(map);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create map error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update map
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const map = await prisma.map.findUnique({ where: { id: req.params.id } });
    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }
    const campaign = await prisma.campaign.findUnique({ where: { id: map.campaignId } });
    if (!campaign || campaign.dmId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the DM can update maps' });
      return;
    }

    const data = updateSchema.parse(req.body);
    const updated = await prisma.map.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete map
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const map = await prisma.map.findUnique({ where: { id: req.params.id } });
  if (!map) {
    res.status(404).json({ error: 'Map not found' });
    return;
  }
  const campaign = await prisma.campaign.findUnique({ where: { id: map.campaignId } });
  if (!campaign || campaign.dmId !== req.user!.userId) {
    res.status(403).json({ error: 'Only the DM can delete maps' });
    return;
  }
  // Cascade: delete tokens, combat trackers, then map
  await prisma.token.deleteMany({ where: { mapId: req.params.id } });
  await prisma.combatTracker.deleteMany({ where: { mapId: req.params.id } });
  await prisma.map.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
