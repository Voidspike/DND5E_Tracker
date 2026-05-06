import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
});

// List user's campaigns
router.get('/', authenticate, async (req: Request, res: Response) => {
  const campaigns = await prisma.campaign.findMany({
    where: {
      OR: [
        { dmId: req.user!.userId },
        { players: { some: { userId: req.user!.userId } } },
      ],
    },
    include: { dm: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(campaigns);
});

// Create campaign
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const inviteCode = uuid().slice(0, 8).toUpperCase();

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description || null,
        inviteCode,
        dmId: req.user!.userId,
      },
      include: { dm: { select: { id: true, username: true, avatarUrl: true } } },
    });

    res.status(201).json(campaign);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create campaign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign by id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      dm: { select: { id: true, username: true, avatarUrl: true } },
      players: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
    },
  });
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  res.json(campaign);
});

// Update campaign
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign || campaign.dmId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the DM can update this campaign' });
      return;
    }

    const data = updateSchema.parse(req.body);
    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data,
      include: { dm: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update campaign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete campaign
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!campaign || campaign.dmId !== req.user!.userId) {
    res.status(403).json({ error: 'Only the DM can delete this campaign' });
    return;
  }
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Join campaign by invite code
router.post('/join/:code', authenticate, async (req: Request, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { inviteCode: req.params.code } });
  if (!campaign) {
    res.status(404).json({ error: 'Invalid invite code' });
    return;
  }

  const existing = await prisma.campaignPlayer.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: req.user!.userId } },
  });
  if (existing) {
    res.status(409).json({ error: 'Already a member of this campaign' });
    return;
  }

  await prisma.campaignPlayer.create({
    data: { campaignId: campaign.id, userId: req.user!.userId, role: 'player' },
  });

  res.json({ message: 'Joined campaign', campaignId: campaign.id });
});

// Leave campaign (player)
router.post('/:id/leave', authenticate, async (req: Request, res: Response) => {
  await prisma.campaignPlayer.deleteMany({
    where: { campaignId: req.params.id, userId: req.user!.userId },
  });
  res.json({ message: 'Left campaign' });
});

// Kick player from campaign (DM only)
router.delete('/:id/players/:userId', authenticate, async (req: Request, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!campaign || campaign.dmId !== req.user!.userId) {
    res.status(403).json({ error: 'Only the DM can remove players' });
    return;
  }
  await prisma.campaignPlayer.deleteMany({
    where: { campaignId: req.params.id, userId: req.params.userId },
  });
  res.json({ message: 'Player removed' });
});

export default router;
