import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Skip if seed data already exists
  const existingUser = await prisma.user.findFirst({ where: { email: 'dm@example.com' } });
  if (existingUser) {
    console.log('Seed data already exists, skipping.');
    return;
  }

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

  // Full DND 5E character: Drow Wild Magic Sorcerer Lv6
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
      tempHp: 0,
      ac: 18,
      proficiency: 2,
      initiative: 2,
      speed: 25,
      darkvision: 60,
      passivePerception: 14,
      stats: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 13, cha: 8 }),
      statSaveProficiencies: JSON.stringify(['str', 'con']),
      skills: JSON.stringify({
        athletics: 5, perception: 3, survival: 3, intimidation: 1,
      }),
      skillProficiencies: JSON.stringify(['athletics', 'perception', 'survival', 'intimidation']),
      hitDice: '3d10',
      resistances: 'Poison',
      languages: 'Common, Dwarvish',
      toolProficiencies: "Smith's tools, Brewer's supplies",
      notes: 'A battle-hardened dwarf fighter seeking glory in Phandelver.',
    },
  });

  // Full DND 5E character: Drow Wild Magic Sorcerer Lv6
  await prisma.character.upsert({
    where: { id: 'seed-character-2' },
    update: {},
    create: {
      id: 'seed-character-2',
      userId: dm.id,
      campaignId: campaign.id,
      name: 'Vaelira',
      class: 'Sorcerer',
      level: 6,
      race: 'Elf',
      subrace: 'Drow',
      gender: 'Female',
      age: 120,
      height: "5'4\"",
      weight: '110 lb',
      alignment: 'Chaotic Good',
      faith: 'Eilistraee',
      xp: 14000,
      proficiency: 3,
      hpCurrent: 20,
      hpMax: 38,
      tempHp: 0,
      ac: 12,
      initiative: 2,
      speed: 30,
      darkvision: 120,
      passivePerception: 14,
      spellcastingClass: 'Sorcerer',
      spellcastingAbility: 'Charisma',
      spellSaveDc: 15,
      spellAttackBonus: 7,
      hitDice: '6d6',
      stats: JSON.stringify({ str: 9, dex: 15, con: 14, int: 12, wis: 12, cha: 18 }),
      statSaveProficiencies: JSON.stringify(['con', 'cha']),
      skills: JSON.stringify({
        acrobatics: 2, sleightOfHand: 2, stealth: 2,
        arcana: 4, investigation: 1, history: 1, nature: 1, religion: 1,
        perception: 4, insight: 1, animalHandling: 1, medicine: 1, survival: 1,
        persuasion: 4, deception: 4, intimidation: 7, performance: 4,
      }),
      skillProficiencies: JSON.stringify(['arcana', 'perception', 'intimidation', 'deception']),
      spells: JSON.stringify({
        'Cantrip': ['Fire Bolt', 'Mage Hand', 'Prestidigitation', 'Minor Illusion', 'Dancing Lights'],
        'Lv1': ['Mage Armor', 'Shield'],
        'Lv2': ['Hold Person', 'Misty Step'],
        'Lv3': ['Fireball', 'Counterspell'],
      }),
      spellSlots: JSON.stringify({
        '1': { max: 4, used: 0 },
        '2': { max: 4, used: 0 },
        '3': { max: 4, used: 0 },
      }),
      weapons: JSON.stringify([
        { name: 'Dagger', atk: 'D20+5', dmg: '1d4+2', type: 'Piercing', properties: 'Finesse, Light, Thrown (20/60)' },
        { name: 'Light Crossbow', atk: 'D20+5', dmg: '1d8+2', type: 'Piercing', properties: 'Ammunition (80/320), Loading, Two-Handed' },
      ]),
      currency: JSON.stringify({ cp: 10, sp: 5, ep: 0, gp: 45, pp: 0 }),
      resistances: 'None',
      immunities: 'Sleep',
      languages: 'Common, Elvish, Undercommon',
      toolProficiencies: 'None',
      notes: 'A drow sorceress touched by wild magic, wandering the surface world.',
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
