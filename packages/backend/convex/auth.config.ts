/**
 * Firebase Auth -> Convex bridge (Month 2 gate: verify exact issuer + audience).
 *
 * During the migration, Firebase Auth stays the identity provider. The web/app
 * clients pass the Firebase ID token to Convex, which validates it as an OIDC
 * JWT. Convex checks:
 *   - issuer  == https://securetoken.google.com/<FIREBASE_PROJECT_ID>
 *   - audience == <FIREBASE_PROJECT_ID>
 * and exposes the token's `sub` (the Firebase uid) via `ctx.auth.getUserIdentity()`.
 *
 * The project id is read from an env var so dev/preview/prod deployments never
 * hard-code a single project. Set it with:
 *   npx convex env set FIREBASE_PROJECT_ID magicboxai-50927
 */
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: process.env.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
      jwks: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`,
      algorithm: "RS256",
    },
  ],
};
