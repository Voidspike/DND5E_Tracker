import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding spells...');

  // Import the spell data from the shared data file
  const spells = require('../../client/src/data/spells').SPELLS as Array<{
    en: string;
    cn: string;
    source: string;
    classes: string;
    level: number;
    school: string;
    castTime: string;
    range: string;
    components: string;
    duration: string;
    desc: string;
  }>;

  // Upsert all spells (by English name as unique key)
  let count = 0;
  for (const s of spells) {
    await prisma.spell.upsert({
      where: { en: s.en },
      update: {
        cn: s.cn,
        source: s.source,
        classes: s.classes,
        level: s.level,
        school: s.school,
        castTime: s.castTime,
        range: s.range,
        components: s.components,
        duration: s.duration,
        desc: s.desc,
      },
      create: {
        en: s.en,
        cn: s.cn,
        source: s.source,
        classes: s.classes,
        level: s.level,
        school: s.school,
        castTime: s.castTime,
        range: s.range,
        components: s.components,
        duration: s.duration,
        desc: s.desc,
      },
    });
    count++;
  }

  console.log(`Seeded ${count} spells.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
