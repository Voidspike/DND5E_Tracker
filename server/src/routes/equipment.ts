import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

const searchQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

// Search equipment by category and/or keyword
router.get('/', authenticate, async (req: Request, res: Response) => {
  const query = searchQuerySchema.parse(req.query);
  const where: Record<string, unknown> = {};

  if (query.category && query.category !== 'all') {
    where.category = query.category;
  }

  if (query.search) {
    where.OR = [
      { cn: { contains: query.search } },
      { en: { contains: query.search } },
    ];
  }

  const items = await prisma.equipment.findMany({
    where,
    orderBy: [{ category: 'asc' }, { cn: 'asc' }],
  });

  res.json(items);
});

export default router;
