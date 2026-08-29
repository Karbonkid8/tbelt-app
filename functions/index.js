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
