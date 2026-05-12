import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import tokenRoutes from '../routes/token';

const app = express();
app.use(express.json());
app.use('/tokens', tokenRoutes);

const DM_ID = 'test-dm-token';
const PLAYER_ID = 'test-player-token';
const OTHER_ID = 'test-other-token';

function authHeader(userId: string, username = 'test') {
  const token = jwt.sign({ userId, username }, config.jwtSecret, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

let testMapId: string;
let testTokenId: string;

beforeAll(async () => {
  // Create test users
  for (const uid of [DM_ID, PLAYER_ID, OTHER_ID]) {
    await prisma.user.upsert({
      where: { id: uid },
      update: {},
      create: { id: uid, username: uid, email: `${uid}@test.com`, password: 'test' },
    });
  }
  // Create test campaign + map
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Test Campaign',
      inviteCode: `TEST-${Date.now()}`,
      dmId: DM_ID,
    },
  });
  const map = await prisma.map.create({
    data: {
      campaignId: campaign.id,
      name: 'Test Map',
      imageUrl: 'https://example.com/map.png',
      width: 30,
      height: 20,
    },
  });
  testMapId = map.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.token.deleteMany({ where: { map: { campaign: { dmId: DM_ID } } } });
  await prisma.combatParticipant.deleteMany({ where: { combat: { campaign: { dmId: DM_ID } } } });
  await prisma.combatTracker.deleteMany({ where: { campaign: { dmId: DM_ID } } });
  await prisma.map.deleteMany({ where: { campaign: { dmId: DM_ID } } });
  await prisma.character.deleteMany({ where: { campaign: { dmId: DM_ID } } });
  await prisma.campaignPlayer.deleteMany({ where: { campaign: { dmId: DM_ID } } });
  await prisma.campaign.deleteMany({ where: { dmId: DM_ID } });
  for (const uid of [DM_ID, PLAYER_ID, OTHER_ID]) {
    await prisma.user.deleteMany({ where: { id: uid } });
  }
});

describe('POST /tokens', () => {
  it('should create a token and set ownerId for non-DM', async () => {
    const res = await request(app)
      .post('/tokens')
      .set('Authorization', authHeader(PLAYER_ID))
      .send({
        mapId: testMapId,
        type: 'character',
        name: 'Player Token',
        x: 1,
        y: 2,
      });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(PLAYER_ID);
    testTokenId = res.body.id;
  });

  it('should allow DM to create token with custom ownerId', async () => {
    const res = await request(app)
      .post('/tokens')
      .set('Authorization', authHeader(DM_ID))
      .send({
        mapId: testMapId,
        type: 'npc',
        name: 'DM Token',
        ownerId: PLAYER_ID,
        x: 3,
        y: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(PLAYER_ID);
  });

  it('should reject without auth', async () => {
    const res = await request(app)
      .post('/tokens')
      .send({ mapId: testMapId, type: 'character', name: 'Bad' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /tokens/:id', () => {
  it('should allow owner to update their token', async () => {
    const res = await request(app)
      .patch(`/tokens/${testTokenId}`)
      .set('Authorization', authHeader(PLAYER_ID))
      .send({ hpCurrent: 20 });
    expect(res.status).toBe(200);
    expect(res.body.hpCurrent).toBe(20);
  });

  it('should allow DM to update any token', async () => {
    const res = await request(app)
      .patch(`/tokens/${testTokenId}`)
      .set('Authorization', authHeader(DM_ID))
      .send({ hpCurrent: 30 });
    expect(res.status).toBe(200);
  });

  it('should reject non-owner non-DM', async () => {
    const res = await request(app)
      .patch(`/tokens/${testTokenId}`)
      .set('Authorization', authHeader(OTHER_ID))
      .send({ hpCurrent: 99 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /tokens/:id', () => {
  it('should reject non-owner non-DM', async () => {
    const res = await request(app)
      .delete(`/tokens/${testTokenId}`)
      .set('Authorization', authHeader(OTHER_ID));
    expect(res.status).toBe(403);
  });

  it('should allow owner to delete their token', async () => {
    const res = await request(app)
      .delete(`/tokens/${testTokenId}`)
      .set('Authorization', authHeader(PLAYER_ID));
    expect(res.status).toBe(204);
  });
});
