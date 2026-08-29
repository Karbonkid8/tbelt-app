const { randomUUID, createHmac } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

initializeApp();

const siteCodePepper = defineSecret('SITE_CODE_PEPPER');

function normaliseCode(value) {
  return String(value || '').trim().toUpperCase();
}

function codeHash(code) {
  return createHmac('sha256', siteCodePepper.value()).update(code).digest('hex');
}

async function requireAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Administrator sign-in is required.');
  }
  const admin = await getFirestore().collection('admins').doc(request.auth.uid).get();
  if (!admin.exists || admin.data().active !== true) {
    throw new HttpsError('permission-denied', 'This account is not a FieldOps administrator.');
  }
}

exports.joinSite = onCall(
  { region: 'us-west3', secrets: [siteCodePepper] },
  async (request) => {
    const siteCode = normaliseCode(request.data?.siteCode);
    const operatorName = String(request.data?.operatorName || '').trim();

    if (siteCode.length < 4 || siteCode.length > 64) {
      throw new HttpsError('invalid-argument', 'Enter a valid Site Code.');
    }
    if (operatorName.length < 2 || operatorName.length > 100) {
      throw new HttpsError('invalid-argument', 'Enter your name.');
    }

    const database = getFirestore();
    const siteMatch = await database
      .collection('sites')
      .where('accessCodeHash', '==', codeHash(siteCode))
      .limit(1)
      .get();

    if (siteMatch.empty) {
      throw new HttpsError('permission-denied', 'That Site Code was not recognized.');
    }

    const site = siteMatch.docs[0];
    const siteData = site.data();
    if (siteData.active !== true) {
      throw new HttpsError('permission-denied', 'This location is not active.');
    }

    const uid = `field-${randomUUID()}`;
    const customToken = await getAuth().createCustomToken(uid, {
      siteId: site.id,
      role: 'field',
    });

    await database.collection('sites').doc(site.id).collection('accessLog').add({
      operatorName,
      joinedAt: FieldValue.serverTimestamp(),
      uid,
    });

    return { customToken, site: { id: site.id, name: siteData.name } };
  },
);

exports.createSite = onCall(
  { region: 'us-west3', secrets: [siteCodePepper] },
  async (request) => {
    await requireAdmin(request);
    const name = String(request.data?.name || '').trim();
    const siteCode = normaliseCode(request.data?.siteCode);
    const siteId = String(request.data?.siteId || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    if (name.length < 2 || name.length > 100 || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(siteId)) {
      throw new HttpsError('invalid-argument', 'Enter a location name with a valid location ID.');
    }
    if (siteCode.length < 4 || siteCode.length > 64) {
      throw new HttpsError('invalid-argument', 'Enter a valid Site Code.');
    }

    const site = getFirestore().collection('sites').doc(siteId);
    if ((await site.get()).exists) {
      throw new HttpsError('already-exists', 'A location already uses that location ID.');
    }

    await site.set({
      name,
      active: true,
      accessCodeHash: codeHash(siteCode),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
    return { site: { id: siteId, name } };
  },
);

exports.updateSite = onCall(
  { region: 'us-west3', secrets: [siteCodePepper] },
  async (request) => {
    await requireAdmin(request);
    const siteId = String(request.data?.siteId || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(siteId)) {
      throw new HttpsError('invalid-argument', 'Enter a valid location ID.');
    }

    const site = getFirestore().collection('sites').doc(siteId);
    if (!(await site.get()).exists) {
      throw new HttpsError('not-found', 'This location no longer exists.');
    }

    const updates = { updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid };
    if (typeof request.data?.active === 'boolean') updates.active = request.data.active;
    if (request.data?.siteCode !== undefined) {
      const siteCode = normaliseCode(request.data.siteCode);
      if (siteCode.length < 4 || siteCode.length > 64) {
        throw new HttpsError('invalid-argument', 'Enter a valid Site Code.');
      }
      updates.accessCodeHash = codeHash(siteCode);
    }
    if (Object.keys(updates).length === 2) {
      throw new HttpsError('invalid-argument', 'Choose a location setting to update.');
    }

    await site.update(updates);
    return { siteId };
  },
);
