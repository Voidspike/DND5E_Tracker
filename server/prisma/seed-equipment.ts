import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Weapon data extracted from xlsx '装备物品' sheet
const WEAPONS = [
  // 简易近战武器
  { en: 'Club', cn: '短棒', sub: '简易近战武器', price: '1sp', damage: '1d4钝击', weight: '2', props: '轻型' },
  { en: 'Dagger', cn: '匕首', sub: '简易近战武器', price: '2gp', damage: '1d4穿刺', weight: '1', props: '灵巧，轻型，投掷（射程20/60）' },
  { en: 'Greatclub', cn: '巨棒', sub: '简易近战武器', price: '2sp', damage: '1d8钝击', weight: '10', props: '双手' },
  { en: 'Handaxe', cn: '手斧', sub: '简易近战武器', price: '5gp', damage: '1d6挥砍', weight: '2', props: '轻型，投掷（射程20/60）' },
  { en: 'Javelin', cn: '标枪', sub: '简易近战武器', price: '5sp', damage: '1d6穿刺', weight: '2', props: '投掷（射程30/120）' },
  { en: 'Light Hammer', cn: '轻锤', sub: '简易近战武器', price: '2gp', damage: '1d4钝击', weight: '2', props: '轻型，投掷（射程20/60）' },
  { en: 'Mace', cn: '硬头锤', sub: '简易近战武器', price: '5gp', damage: '1d6钝击', weight: '4', props: '－' },
  { en: 'Quarterstaff', cn: '长棍', sub: '简易近战武器', price: '2sp', damage: '1d6钝击', weight: '4', props: '两用（1d8）' },
  { en: 'Sickle', cn: '镰刀', sub: '简易近战武器', price: '1gp', damage: '1d4挥砍', weight: '2', props: '轻型' },
  { en: 'Spear', cn: '矛', sub: '简易近战武器', price: '1gp', damage: '1d6穿刺', weight: '3', props: '投掷（射程20/60），两用（1d8）' },
  // 简易远程武器
  { en: 'Light Crossbow', cn: '轻弩', sub: '简易远程武器', price: '25gp', damage: '1d8穿刺', weight: '5', props: '弹药（射程80/320），装填，双手' },
  { en: 'Dart', cn: '飞镖', sub: '简易远程武器', price: '5cp', damage: '1d4穿刺', weight: '0.25', props: '灵巧，投掷（射程20/60）' },
  { en: 'Shortbow', cn: '短弓', sub: '简易远程武器', price: '25gp', damage: '1d6穿刺', weight: '2', props: '弹药（射程80/320），双手' },
  { en: 'Sling', cn: '投石索', sub: '简易远程武器', price: '1sp', damage: '1d4钝击', weight: '—', props: '弹药（射程30/120）' },
  // 军用近战武器
  { en: 'Battleaxe', cn: '战斧', sub: '军用近战武器', price: '10gp', damage: '1d8挥砍', weight: '4', props: '两用（1d10）' },
  { en: 'Flail', cn: '链枷', sub: '军用近战武器', price: '10gp', damage: '1d8钝击', weight: '2', props: '－' },
  { en: 'Glaive', cn: '大砍刀', sub: '军用近战武器', price: '20gp', damage: '1d10挥砍', weight: '6', props: '重型，触及，双手' },
  { en: 'Greataxe', cn: '巨斧', sub: '军用近战武器', price: '30gp', damage: '1d12挥砍', weight: '7', props: '重型，双手' },
  { en: 'Greatsword', cn: '巨剑', sub: '军用近战武器', price: '50gp', damage: '2d6挥砍', weight: '6', props: '重型，双手' },
  { en: 'Halberd', cn: '戟', sub: '军用近战武器', price: '20gp', damage: '1d10挥砍', weight: '6', props: '重型，触及，双手' },
  { en: 'Lance', cn: '骑枪', sub: '军用近战武器', price: '10gp', damage: '1d12穿刺', weight: '6', props: '触及，特殊' },
  { en: 'Longsword', cn: '长剑', sub: '军用近战武器', price: '15gp', damage: '1d8挥砍', weight: '3', props: '两用（1d10）' },
  { en: 'Maul', cn: '巨锤', sub: '军用近战武器', price: '10gp', damage: '2d6钝击', weight: '10', props: '重型，双手' },
  { en: 'Morningstar', cn: '钉头锤', sub: '军用近战武器', price: '15gp', damage: '1d8穿刺', weight: '4', props: '－' },
  { en: 'Pike', cn: '长矛', sub: '军用近战武器', price: '5gp', damage: '1d10穿刺', weight: '18', props: '重型，触及，双手' },
  { en: 'Rapier', cn: '刺剑', sub: '军用近战武器', price: '25gp', damage: '1d8穿刺', weight: '2', props: '灵巧' },
  { en: 'Scimitar', cn: '弯刀', sub: '军用近战武器', price: '25gp', damage: '1d6挥砍', weight: '3', props: '灵巧，轻型' },
  { en: 'Shortsword', cn: '短剑', sub: '军用近战武器', price: '10gp', damage: '1d6穿刺', weight: '2', props: '灵巧，轻型' },
  { en: 'Trident', cn: '三叉戟', sub: '军用近战武器', price: '5gp', damage: '1d6穿刺', weight: '4', props: '投掷（射程20/60），两用（1d8）' },
  { en: 'War Pick', cn: '战镐', sub: '军用近战武器', price: '5gp', damage: '1d8穿刺', weight: '2', props: '—' },
  { en: 'Warhammer', cn: '战锤', sub: '军用近战武器', price: '15gp', damage: '1d8钝击', weight: '2', props: '两用（1d10）' },
  { en: 'Whip', cn: '鞭', sub: '军用近战武器', price: '2gp', damage: '1d4挥砍', weight: '3', props: '灵巧，触及' },
  // 军用远程武器
  { en: 'Blowgun', cn: '吹箭筒', sub: '军用远程武器', price: '10gp', damage: '1穿刺', weight: '1', props: '弹药（射程25/100），装填' },
  { en: 'Hand Crossbow', cn: '手弩', sub: '军用远程武器', price: '75gp', damage: '1d6穿刺', weight: '3', props: '弹药（射程30/120），轻型，装填' },
  { en: 'Heavy Crossbow', cn: '重弩', sub: '军用远程武器', price: '50gp', damage: '1d10穿刺', weight: '18', props: '弹药（射程100/400），重型，装填，双手' },
  { en: 'Longbow', cn: '长弓', sub: '军用远程武器', price: '50gp', damage: '1d8穿刺', weight: '2', props: '弹药（射程150/600），重型，双手' },
  { en: 'Net', cn: '捕网', sub: '军用远程武器', price: '1gp', damage: '—', weight: '3', props: '特殊，投掷（射程5/15）' },
];

const ARMOR = [
  // 轻甲
  { en: 'Padded', cn: '布甲', sub: '轻甲', price: '5gp', ac: '11＋敏捷调整值', str: '－', stealth: '劣势', weight: '8' },
  { en: 'Leather', cn: '皮甲', sub: '轻甲', price: '10gp', ac: '11＋敏捷调整值', str: '－', stealth: '－', weight: '10' },
  { en: 'Studded Leather', cn: '镶钉皮甲', sub: '轻甲', price: '45gp', ac: '12＋敏捷调整值', str: '－', stealth: '－', weight: '13' },
  // 中甲
  { en: 'Hide', cn: '兽皮甲', sub: '中甲', price: '10gp', ac: '12＋敏捷调整值(最大2)', str: '－', stealth: '－', weight: '12' },
  { en: 'Chain Shirt', cn: '链甲衫', sub: '中甲', price: '50gp', ac: '13＋敏捷调整值(最大2)', str: '－', stealth: '－', weight: '20' },
  { en: 'Scale Mail', cn: '鳞甲', sub: '中甲', price: '50gp', ac: '14＋敏捷调整值(最大2)', str: '－', stealth: '劣势', weight: '45' },
  { en: 'Breastplate', cn: '胸甲', sub: '中甲', price: '400gp', ac: '14＋敏捷调整值(最大2)', str: '－', stealth: '－', weight: '20' },
  { en: 'Half Plate', cn: '半身板甲', sub: '中甲', price: '750gp', ac: '15＋敏捷调整值(最大2)', str: '－', stealth: '劣势', weight: '40' },
  // 重甲
  { en: 'Ring Mail', cn: '环甲', sub: '重甲', price: '30gp', ac: '14', str: '－', stealth: '劣势', weight: '40' },
  { en: 'Chain Mail', cn: '链甲', sub: '重甲', price: '75gp', ac: '16', str: '力量13', stealth: '劣势', weight: '55' },
  { en: 'Splint', cn: '板条甲', sub: '重甲', price: '200gp', ac: '17', str: '力量15', stealth: '劣势', weight: '60' },
  { en: 'Plate', cn: '板甲', sub: '重甲', price: '1500gp', ac: '18', str: '力量15', stealth: '劣势', weight: '65' },
  // 盾牌
  { en: 'Shield', cn: '盾牌', sub: '盾牌', price: '10gp', ac: '2', str: '－', stealth: '－', weight: '6' },
];

async function main() {
  console.log('Seeding weapons...');
  for (const w of WEAPONS) {
    await prisma.equipment.upsert({
      where: { en: w.en },
      update: {},
      create: {
        en: w.en, cn: w.cn, category: 'weapon', subcategory: w.sub,
        price: w.price, damage: w.damage, weight: w.weight, properties: w.props,
      },
    });
  }

  console.log('Seeding armor...');
  for (const a of ARMOR) {
    await prisma.equipment.upsert({
      where: { en: a.en },
      update: {},
      create: {
        en: a.en, cn: a.cn, category: 'armor', subcategory: a.sub,
        price: a.price, weight: a.weight, ac: a.ac,
        strRequirement: a.str, stealth: a.stealth,
      },
    });
  }

  console.log(`Seeded ${WEAPONS.length} weapons + ${ARMOR.length} armor pieces.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
