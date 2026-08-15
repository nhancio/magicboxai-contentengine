import admin from "firebase-admin";
import crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert("/tmp/magicbox-service-account.json"),
    projectId: "magicboxai-50927",
  });
}

const auth = admin.auth();
const db = admin.firestore();

const targetEmails = [
  "nithindidigam@nhancio.com",
  "nithindidigam@gmail.com",
  "nithin@theondemandcompany.com",
  "nithin@gthree.agency",
  "nithindidigam@resgro.ai",
];

async function run() {
  console.log("=== Detailed Firestore Inspection ===");
  const userMap = {};

  for (const email of targetEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      userMap[email] = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      };
      console.log(`[Auth] ${email} -> UID: ${user.uid}`);
    } catch (e) {
      userMap[email] = null;
      console.log(`[Auth] ${email} -> NOT FOUND`);
    }
  }

  const uids = Object.values(userMap).filter(Boolean).map(u => u.uid);

  // List all collections in Firestore
  const collections = await db.listCollections();
  console.log(`\nFound ${collections.length} collections:`, collections.map(c => c.id));

  for (const coll of collections) {
    console.log(`\n--- Inspecting Collection: ${coll.id} ---`);
    const snap = await coll.get();
    console.log(`Total documents in ${coll.id}: ${snap.size}`);

    for (const doc of snap.docs) {
      const data = doc.data();
      const docId = doc.id;

      // Check if doc matches any target email or UID
      let matchedEmail = null;
      for (const email of targetEmails) {
        if (
          docId.toLowerCase() === email.toLowerCase() ||
          data.email?.toLowerCase() === email.toLowerCase() ||
          data.guestEmail?.toLowerCase() === email.toLowerCase() ||
          data.contactEmail?.toLowerCase() === email.toLowerCase()
        ) {
          matchedEmail = email;
          break;
        }
      }

      let matchedUid = null;
      for (const uid of uids) {
        const userKey = crypto.createHash("sha256").update(uid).digest("base64url");
        if (
          docId === uid ||
          docId === userKey ||
          data.userId === uid ||
          data.uid === uid ||
          data.claimedByUid === uid
        ) {
          matchedUid = uid;
          break;
        }
      }

      if (matchedEmail || matchedUid) {
        console.log(`  [MATCH] Doc ID: ${docId} (matchedEmail: ${matchedEmail}, matchedUid: ${matchedUid})`);
        console.log(`          Data:`, JSON.stringify(data).slice(0, 150));

        // Check subcollections
        const subcolls = await doc.ref.listCollections();
        if (subcolls.length > 0) {
          console.log(`          Subcollections:`, subcolls.map(s => s.id));
          for (const sub of subcolls) {
            const subSnap = await sub.get();
            console.log(`            Subcollection ${sub.id}: ${subSnap.size} docs`);
          }
        }
      }
    }
  }
}

run().catch(console.error);
