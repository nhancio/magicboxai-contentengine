import admin from "firebase-admin";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../packages/backend/convex/_generated/api.js";

import fs from "fs";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (fs.existsSync("/tmp/magicbox-service-account.json") ? "/tmp/magicbox-service-account.json" : null);

  if (serviceAccountPath) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      projectId: "magicboxai-50927",
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "magicboxai-50927",
    });
  }
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage().bucket("magicboxai-50927.firebasestorage.app");

// Initialize Convex Client
const CONVEX_URL = process.env.CONVEX_URL || "http://136.107.79.221:3210";
const convexClient = new ConvexHttpClient(CONVEX_URL);

// Target users configuration
const TARGET_USERS = [
  {
    email: "nithindidigam@nhancio.com",
    knownUids: ["YmdwrjAUP0bVJy5BNwsvy7mt9vD3", "7lpDTFAJ9HU0uGYwK8H1LiF1GNA3"],
  },
  {
    email: "nithindidigam@gmail.com",
    knownUids: ["yPEPpZb2J4ZYvF1wNmJmKBtNq1h2"],
  },
  {
    email: "nithin@theondemandcompany.com",
    knownUids: ["5lfFl1itCEdDL93LN3qDXL3jr6F2"],
  },
  {
    email: "nithin@gthree.agency",
    knownUids: [],
  },
  {
    email: "nithindidigam@resgro.ai",
    knownUids: [],
  },
];

async function main() {
  console.log("================================================================================");
  console.log("             MAGICBOX AI — COMPLETE 5-USER ACCOUNT RESET PIPELINE               ");
  console.log("================================================================================\n");

  const report = {};

  for (const target of TARGET_USERS) {
    const email = target.email.toLowerCase();
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`>>> PROCESSING RESET FOR: ${email}`);
    console.log(`--------------------------------------------------------------------------------`);

    // Discover any additional live UIDs from Firebase Auth
    const uids = new Set(target.knownUids);
    try {
      const authUser = await auth.getUserByEmail(email);
      if (authUser?.uid) {
        uids.add(authUser.uid);
        console.log(`  Found active Firebase Auth user: uid=${authUser.uid}`);
      }
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        console.log(`  No active Firebase Auth record found for ${email}`);
      } else {
        console.error(`  Auth lookup error for ${email}:`, e.message);
      }
    }

    const uidList = Array.from(uids);
    console.log(`  Target UIDs to purge: [${uidList.join(", ") || "none"}]`);

    const userReport = {
      email,
      uids: uidList,
      convex: { tables: {}, total: 0 },
      firestore: { collections: {}, total: 0 },
      storage: { deletedFiles: 0 },
      auth: { deleted: false, uid: null },
    };

    // =========================================================================
    // 1. CONVEX PURGE
    // =========================================================================
    console.log(`\n  [1/4] Purging Convex database records...`);
    // Purge by each UID
    for (const uid of uidList) {
      try {
        const result = await convexClient.mutation(api.cleanup.purgeUser, { uid });
        for (const [tbl, count] of Object.entries(result.deletedCounts)) {
          if (count > 0) {
            userReport.convex.tables[tbl] = (userReport.convex.tables[tbl] || 0) + count;
            userReport.convex.total += count;
          }
        }
      } catch (err) {
        console.error(`    Error purging Convex by UID ${uid}:`, err.message);
      }
    }

    // Purge by Email
    try {
      const result = await convexClient.mutation(api.cleanup.purgeUser, { email });
      for (const [tbl, count] of Object.entries(result.deletedCounts)) {
        if (count > 0) {
          userReport.convex.tables[tbl] = (userReport.convex.tables[tbl] || 0) + count;
          userReport.convex.total += count;
        }
      }
    } catch (err) {
      console.error(`    Error purging Convex by email ${email}:`, err.message);
    }

    console.log(`    ✔ Convex deleted: ${userReport.convex.total} total records across tables:`, userReport.convex.tables);

    // =========================================================================
    // 2. FIRESTORE PURGE
    // =========================================================================
    console.log(`\n  [2/4] Purging Firestore documents...`);
    const allCollections = await db.listCollections();

    for (const coll of allCollections) {
      const snap = await coll.get();
      let collDeleted = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        const docId = doc.id;
        const docJson = JSON.stringify(data).toLowerCase();

        let isMatch = false;

        // ID match
        if (uidList.includes(docId) || docId.toLowerCase() === email) {
          isMatch = true;
        }

        // Field match
        for (const uid of uidList) {
          if (
            data.userId === uid ||
            data.uid === uid ||
            data.legacyId === uid ||
            data.claimedByUid === uid
          ) {
            isMatch = true;
          }
        }

        // Email match
        if (
          (data.email && data.email.toLowerCase() === email) ||
          (data.guestEmail && data.guestEmail.toLowerCase() === email) ||
          (data.contactEmail && data.contactEmail.toLowerCase() === email)
        ) {
          isMatch = true;
        }

        // Deep search match
        if (!isMatch && docJson.includes(email)) {
          isMatch = true;
        }

        if (isMatch) {
          await doc.ref.delete();
          collDeleted++;
        }
      }

      if (collDeleted > 0) {
        userReport.firestore.collections[coll.id] = collDeleted;
        userReport.firestore.total += collDeleted;
        console.log(`    - Collection [${coll.id}]: deleted ${collDeleted} docs`);
      }
    }
    console.log(`    ✔ Firestore deleted: ${userReport.firestore.total} total documents`);

    // =========================================================================
    // 3. FIREBASE STORAGE PURGE
    // =========================================================================
    console.log(`\n  [3/4] Purging Firebase Storage files...`);
    for (const uid of uidList) {
      const prefixes = [`users/${uid}/`, `avatars/${uid}/`, `videos/${uid}/`];
      for (const prefix of prefixes) {
        try {
          const [files] = await storage.getFiles({ prefix });
          for (const file of files) {
            await file.delete();
            userReport.storage.deletedFiles++;
          }
          if (files.length > 0) {
            console.log(`    - Storage prefix [${prefix}]: deleted ${files.length} files`);
          }
        } catch (e) {
          console.error(`    Error deleting storage files for prefix ${prefix}:`, e.message);
        }
      }
    }
    console.log(`    ✔ Storage deleted: ${userReport.storage.deletedFiles} total files`);

    // =========================================================================
    // 4. FIREBASE AUTH PURGE
    // =========================================================================
    console.log(`\n  [4/4] Purging Firebase Auth record...`);
    for (const uid of uidList) {
      try {
        await auth.deleteUser(uid);
        console.log(`    ✔ Deleted Auth user with UID: ${uid}`);
        userReport.auth.deleted = true;
        userReport.auth.uid = uid;
      } catch (e) {
        if (e.code === "auth/user-not-found") {
          console.log(`    - UID ${uid} already absent in Firebase Auth`);
        } else {
          console.error(`    Error deleting Auth user UID ${uid}:`, e.message);
        }
      }
    }

    try {
      const authUser = await auth.getUserByEmail(email);
      if (authUser) {
        await auth.deleteUser(authUser.uid);
        console.log(`    ✔ Deleted Auth user by email: ${authUser.uid}`);
        userReport.auth.deleted = true;
        userReport.auth.uid = authUser.uid;
      }
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        console.log(`    - Email ${email} absent in Firebase Auth`);
      }
    }

    report[email] = userReport;
  }

  // ===========================================================================
  // VERIFICATION STAGE
  // ===========================================================================
  console.log("\n================================================================================");
  console.log("                         POST-RESET VERIFICATION CHECK                         ");
  console.log("================================================================================\n");

  let allVerified = true;

  for (const target of TARGET_USERS) {
    const email = target.email.toLowerCase();
    const uids = report[email].uids;
    console.log(`Checking target: ${email}...`);

    // 1. Firebase Auth Check
    let authCount = 0;
    try {
      const u = await auth.getUserByEmail(email);
      if (u) authCount++;
    } catch (e) {
      if (e.code !== "auth/user-not-found") console.error("Auth verify error:", e.message);
    }
    for (const uid of uids) {
      try {
        const u = await auth.getUser(uid);
        if (u) authCount++;
      } catch (e) {
        if (e.code !== "auth/user-not-found") console.error("Auth verify error:", e.message);
      }
    }

    // 2. Firestore Check
    let firestoreCount = 0;
    const collections = await db.listCollections();
    for (const coll of collections) {
      const snap = await coll.get();
      for (const doc of snap.docs) {
        const data = doc.data();
        const docId = doc.id;
        const docJson = JSON.stringify(data).toLowerCase();

        if (
          uids.includes(docId) ||
          docId.toLowerCase() === email ||
          (data.email && data.email.toLowerCase() === email) ||
          (data.userId && uids.includes(data.userId)) ||
          (data.uid && uids.includes(data.uid)) ||
          (data.legacyId && uids.includes(data.legacyId)) ||
          docJson.includes(email)
        ) {
          firestoreCount++;
          console.warn(`    ⚠ Found lingering doc: ${coll.id}/${doc.id}`);
        }
      }
    }

    // 3. Convex Check
    let convexCount = 0;
    try {
      const byEmail = await convexClient.query(api.cleanup.inspectUser, { email });
      convexCount += byEmail.total;
      for (const uid of uids) {
        const byUid = await convexClient.query(api.cleanup.inspectUser, { uid });
        convexCount += byUid.total;
      }
    } catch (err) {
      console.error("Convex verify error:", err.message);
    }

    // 4. Storage Check
    let storageCount = 0;
    for (const uid of uids) {
      try {
        const [files] = await storage.getFiles({ prefix: `users/${uid}/` });
        storageCount += files.length;
      } catch (_) {}
    }

    console.log(`  -> Firebase Auth Records: ${authCount} ${authCount === 0 ? "✔ (0 records)" : "✖"}`);
    console.log(`  -> Firestore Documents:   ${firestoreCount} ${firestoreCount === 0 ? "✔ (0 documents)" : "✖"}`);
    console.log(`  -> Convex Records:        ${convexCount} ${convexCount === 0 ? "✔ (0 records)" : "✖"}`);
    console.log(`  -> Storage Files:         ${storageCount} ${storageCount === 0 ? "✔ (0 files)" : "✖"}`);

    if (authCount > 0 || firestoreCount > 0 || convexCount > 0 || storageCount > 0) {
      allVerified = false;
    }
  }

  console.log("\n================================================================================");
  console.log("                              FINAL RESET REPORT                                ");
  console.log("================================================================================\n");

  console.log(JSON.stringify(report, null, 2));

  if (allVerified) {
    console.log("\n✔ ALL 5 TARGET ACCOUNTS HAVE BEEN 100% PURGED & RESET ACROSS ALL SYSTEMS.");
  } else {
    console.log("\n✖ WARNING: SOME RECORDS WERE NOT FULLY PURGED.");
  }
}

main().catch(console.error);
