import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const dm = await prisma.user.upsert({
    where: { email: 'dm@example.com' },
    update: {},
    create: { username: 'DungeonMaster', email: 'dm@example.com', password },
  });

  const player = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {},
    create: { username: 'Adventurer', email: 'player@example.com', password },
  });

  const campaign = await prisma.campaign.upsert({
    where: { inviteCode: 'DND2024' },
    update: {},
    create: {
      name: 'The Lost Mine of Phandelver',
      description: 'A classic D&D starter adventure.',
      inviteCode: 'DND2024',
      dmId: dm.id,
    },
  });

  await prisma.campaignPlayer.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: player.id } },
    update: {},
    create: { campaignId: campaign.id, userId: player.id, role: 'player' },
  });

  await prisma.character.upsert({
    where: { id: 'seed-character-1' },
    update: {},
    create: {
      id: 'seed-character-1',
      userId: player.id,
      campaignId: campaign.id,
      name: 'Ragnar Stoneheart',
      class: 'Fighter',
      level: 3,
      race: 'Dwarf',
      hpCurrent: 35,
      hpMax: 35,
      ac: 18,
      stats: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 13, cha: 8 }),
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
