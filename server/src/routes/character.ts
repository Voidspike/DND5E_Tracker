import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const statSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

const createSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1).max(100),
  class: z.string().min(1).max(50),
  race: z.string().min(1).max(50),
  stats: statSchema,
  hpMax: z.number().int().positive(),
  ac: z.number().int().positive(),
  subrace: z.string().optional(),
  gender: z.string().optional(),
  level: z.number().int().positive().optional(),
  proficiency: z.number().int().optional(),
  speed: z.number().int().optional(),
  darkvision: z.number().int().optional(),
  initiative: z.number().int().optional(),
  passivePerception: z.number().int().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  class: z.string().min(1).max(50).optional(),
  level: z.number().int().positive().optional(),
  race: z.string().min(1).max(50).optional(),
  subrace: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  age: z.number().int().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  alignment: z.string().nullable().optional(),
  faith: z.string().nullable().optional(),
  xp: z.number().int().optional(),
  proficiency: z.number().int().optional(),
  hpCurrent: z.number().int().optional(),
  hpMax: z.number().int().positive().optional(),
  tempHp: z.number().int().optional(),
  ac: z.number().int().positive().optional(),
  initiative: z.number().int().optional(),
  speed: z.number().int().optional(),
  darkvision: z.number().int().optional(),
  passivePerception: z.number().int().optional(),
  spellcastingClass: z.string().nullable().optional(),
  spellcastingAbility: z.string().nullable().optional(),
  spellSaveDc: z.number().int().nullable().optional(),
  spellAttackBonus: z.number().int().nullable().optional(),
  hitDice: z.string().nullable().optional(),
  stats: statSchema.optional(),
  statSaveProficiencies: z.array(z.string()).nullable().optional(),
  skills: z.record(z.number()).nullable().optional(),
  skillProficiencies: z.array(z.string()).nullable().optional(),
  spells: z.record(z.unknown()).nullable().optional(),
  spellSlots: z.record(z.object({ max: z.number(), used: z.number() })).nullable().optional(),
  weapons: z.array(z.record(z.unknown())).nullable().optional(),
  armor: z.record(z.unknown()).nullable().optional(),
  currency: z.record(z.number()).nullable().optional(),
  equipment: z.array(z.record(z.unknown())).nullable().optional(),
  inventory: z.record(z.unknown()).nullable().optional(),
  resistances: z.string().nullable().optional(),
  immunities: z.string().nullable().optional(),
  languages: z.string().nullable().optional(),
  toolProficiencies: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

// JSON fields that need stringify
const jsonFields = [
  'stats', 'statSaveProficiencies', 'skills', 'skillProficiencies',
  'spells', 'spellSlots', 'weapons', 'armor', 'currency', 'equipment', 'inventory',
];

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
        subrace: data.subrace,
        gender: data.gender,
        level: data.level || 1,
        hpCurrent: data.hpMax,
        hpMax: data.hpMax,
        ac: data.ac,
        proficiency: data.proficiency || 2,
        initiative: data.initiative || 0,
        speed: data.speed || 30,
        darkvision: data.darkvision || 0,
        passivePerception: data.passivePerception || 10,
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

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (jsonFields.includes(key)) {
        updateData[key] = value === null ? null : JSON.stringify(value);
      } else {
        updateData[key] = value;
      }
    }

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
