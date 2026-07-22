// Lazy-loaded by Login.tsx only while the Google popup is open, so the
// lottie runtime + JSON stay out of the login-critical bundle.
import LottieImport from "lottie-react";
import loadingAnimation from "../assets/lottie/loading-brand.json";

// lottie-react ships CJS `main` + ESM `module`; depending on how the bundler
// interops, the default import can arrive double-wrapped.
const Lottie =
  (LottieImport as unknown as { default?: typeof LottieImport }).default ?? LottieImport;

export default function LoginLottie() {
  return (
    <Lottie
      animationData={loadingAnimation}
      loop
      className="mx-auto h-28 w-auto"
      aria-hidden
    />
  );
}
