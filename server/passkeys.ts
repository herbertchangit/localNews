// @ts-nocheck
import express from "express";
import jwt from "jsonwebtoken";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { PrismaClient, Role } from "@prisma/client";

const fiveMinutes = 5 * 60 * 1000;
const credentialName = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : "Face login / Device passkey";

export function createPasskeyRouter(
  db: PrismaClient,
  secret: string,
  auth: express.RequestHandler,
) {
  const router = express.Router();
  const relyingParty = (req: express.Request) => {
    const origin =
      process.env.WEBAUTHN_ORIGIN ||
      `${req.protocol}://${req.get("host")}`;
    const url = new URL(origin);
    return {
      origin: url.origin,
      rpId: process.env.WEBAUTHN_RP_ID || url.hostname,
    };
  };
  const saveChallenge = async (
    challenge: string,
    type: "registration" | "authentication",
    req: express.Request,
    userId?: string,
  ) => {
    const { origin, rpId } = relyingParty(req);
    await db.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return db.webAuthnChallenge.create({
      data: {
        challenge,
        type,
        userId,
        origin,
        rpId,
        expiresAt: new Date(Date.now() + fiveMinutes),
      },
    });
  };
  const takeChallenge = async (id: string, type: string) => {
    const challenge = await db.webAuthnChallenge.findFirst({
      where: { id, type, expiresAt: { gt: new Date() } },
    });
    if (challenge) {
      await db.webAuthnChallenge.delete({ where: { id: challenge.id } });
    }
    return challenge;
  };
  const publicUser = (user: any) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roles: user.roles?.length ? user.roles : [user.role],
    avatarUrl: user.avatarUrl,
  });

  router.get("/", auth, async (req: any, res) => {
    res.json(
      await db.passkeyCredential.findMany({
        where: { userId: req.user.id },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  router.post("/register/options", auth, async (req: any, res) => {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      include: { passkeys: true },
    });
    if (!user || user.locked || user.suspended) {
      return res.status(403).json({ error: "Account is unavailable" });
    }
    const { rpId } = relyingParty(req);
    const options = await generateRegistrationOptions({
      rpName: "Local News",
      rpID: rpId,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: "none",
      excludeCredentials: user.passkeys.map((item) => ({
        id: item.credentialId,
        transports: item.transports,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      supportedAlgorithmIDs: [-7, -257],
    });
    const challenge = await saveChallenge(
      options.challenge,
      "registration",
      req,
      user.id,
    );
    res.json({ challengeId: challenge.id, options });
  });

  router.post("/register/verify", auth, async (req: any, res) => {
    try {
      const { challengeId, response, name } = req.body || {};
      const challenge = await takeChallenge(challengeId, "registration");
      if (!challenge || challenge.userId !== req.user.id) {
        return res.status(400).json({ error: "Face login setup expired. Try again." });
      }
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rpId,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: "Device verification failed" });
      }
      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;
      const passkey = await db.passkeyCredential.create({
        data: {
          credentialId: credential.id,
          userId: req.user.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports || response?.response?.transports || [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          name: credentialName(name),
        },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
      });
      await db.auditLog.create({
        data: { action: "PASSKEY_REGISTERED", actorId: req.user.id },
      });
      res.status(201).json(passkey);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Could not enable face login" });
    }
  });

  router.delete("/:id", auth, async (req: any, res) => {
    const removed = await db.passkeyCredential.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!removed.count) return res.status(404).json({ error: "Passkey not found" });
    await db.auditLog.create({
      data: { action: "PASSKEY_REMOVED", actorId: req.user.id },
    });
    res.status(204).end();
  });

  router.post("/authenticate/options", async (req, res) => {
    const { rpId } = relyingParty(req);
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "required",
    });
    const challenge = await saveChallenge(
      options.challenge,
      "authentication",
      req,
    );
    res.json({ challengeId: challenge.id, options });
  });

  router.post("/authenticate/verify", async (req, res) => {
    try {
      const { challengeId, response } = req.body || {};
      const challenge = await takeChallenge(challengeId, "authentication");
      if (!challenge) {
        return res.status(400).json({ error: "Face login expired. Try again." });
      }
      const stored = await db.passkeyCredential.findUnique({
        where: { credentialId: response?.id || "" },
        include: { user: true },
      });
      if (!stored || stored.user.locked || stored.user.suspended) {
        return res.status(401).json({ error: "Face login is not available for this account" });
      }
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rpId,
        requireUserVerification: true,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(stored.publicKey),
          counter: Number(stored.counter),
          transports: stored.transports,
        },
      });
      if (!verification.verified) {
        return res.status(401).json({ error: "Face verification failed" });
      }
      await db.passkeyCredential.update({
        where: { id: stored.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
        },
      });
      await db.auditLog.create({
        data: { action: "PASSKEY_LOGIN", actorId: stored.user.id },
      });
      const token = jwt.sign(
        { id: stored.user.id, role: stored.user.role as Role },
        secret,
        { expiresIn: "8h" },
      );
      res.json({ token, user: publicUser(stored.user) });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Face login failed" });
    }
  });

  return router;
}
