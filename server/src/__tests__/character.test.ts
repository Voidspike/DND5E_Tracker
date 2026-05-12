import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import characterRoutes from '../routes/character';

const app = express();
app.use(express.json());
app.use('/characters', characterRoutes);

const DM_ID = 'test-dm-char';
const PLAYER_ID = 'test-player-char';
const OTHER_ID = 'test-other-char';

function authHeader(userId: string, username = 'test') {
  const token = jwt.sign({ userId, username }, config.jwtSecret, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

let campaignId: string;
let testCharId: string;

beforeAll(async () => {
  for (const uid of [DM_ID, PLAYER_ID, OTHER_ID]) {
    await prisma.user.upsert({
      where: { id: uid },
      update: {},
      create: { id: uid, username: uid, email: `${uid}@test.com`, password: 'test' },
    });
  }
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Test Campaign Char',
      inviteCode: `CHARTEST-${Date.now()}`,
      dmId: DM_ID,
    },
  });
  campaignId = campaign.id;
});

afterAll(async () => {
  await prisma.character.deleteMany({ where: { campaignId } });
  await prisma.campaignPlayer.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  for (const uid of [DM_ID, PLAYER_ID, OTHER_ID]) {
    await prisma.user.deleteMany({ where: { id: uid } });
  }
});

describe('POST /characters', () => {
  it('should create a character for the authenticated user', async () => {
    const res = await request(app)
      .post('/characters')
      .set('Authorization', authHeader(PLAYER_ID))
      .send({
        campaignId,
        name: 'Test Char',
        class: 'Fighter',
        race: 'Human',
        stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
        hpMax: 30,
        ac: 16,
      });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(PLAYER_ID);
    testCharId = res.body.id;
  });
});

describe('PATCH /characters/:id', () => {
  it('should allow owner to edit', async () => {
    const res = await request(app)
      .patch(`/characters/${testCharId}`)
      .set('Authorization', authHeader(PLAYER_ID))
      .send({ hpCurrent: 25 });
    expect(res.status).toBe(200);
  });

  it('should reject non-owner', async () => {
    const res = await request(app)
      .patch(`/characters/${testCharId}`)
      .set('Authorization', authHeader(OTHER_ID))
      .send({ hpCurrent: 10 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /characters/:id', () => {
  it('should reject non-owner non-DM', async () => {
    const res = await request(app)
      .delete(`/characters/${testCharId}`)
      .set('Authorization', authHeader(OTHER_ID));
    expect(res.status).toBe(403);
  });

  it('should allow DM to delete any character', async () => {
    const res = await request(app)
      .delete(`/characters/${testCharId}`)
      .set('Authorization', authHeader(DM_ID));
    expect(res.status).toBe(204);
  });
});
