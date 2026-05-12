import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

// Search spells by class and/or level
router.get('/', authenticate, async (req: Request, res: Response) => {
  const { class: className, level, search } = req.query;

  const where: any = {};

  if (className && typeof className === 'string') {
    // classes field is a comma-separated string like "法师,术士"
    where.classes = { contains: className };
  }

  if (level !== undefined && level !== '') {
    where.level = parseInt(level as string, 10);
  }

  if (search && typeof search === 'string') {
    where.OR = [
      { cn: { contains: search } },
      { en: { contains: search, mode: 'insensitive' as any } },
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
  const spell = await prisma.spell.findUnique({ where: { id: req.params.id } });
  if (!spell) {
    res.status(404).json({ error: 'Spell not found' });
    return;
  }
  res.json(spell);
});

export default router;
