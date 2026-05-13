import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const searchQuerySchema = z.object({
  class: z.string().optional(),
  level: z.string().optional(),
  search: z.string().optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

// Search spells by class and/or level
router.get('/', authenticate, async (req: Request, res: Response) => {
  const query = searchQuerySchema.parse(req.query);
  const where: Record<string, unknown> = {};

  if (query.class) {
    where.classes = { contains: query.class };
  }

  if (query.level !== undefined) {
    where.level = parseInt(query.level, 10);
  }

  if (query.search) {
    where.OR = [
      { cn: { contains: query.search } },
      { en: { contains: query.search } },
    ];
  }

  const spells = await prisma.spell.findMany({
    where,
    orderBy: [{ level: 'asc' }, { cn: 'asc' }],
  });

  res.json(spells);
});

// Get single spell by ID
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const spell = await prisma.spell.findUnique({ where: { id } });
  if (!spell) {
    res.status(404).json({ error: 'Spell not found' });
    return;
  }
  res.json(spell);
});

export default router;
