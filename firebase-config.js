// ShipCopy — Firebase web config (enables the CLOUD half of hybrid inference).
// Leave as null to run on-device only. To enable cloud fallback (owner, ~5 min):
//   1. https://console.firebase.google.com → Create project → Add app → Web.
//   2. Build → "AI Logic" → Get started → Gemini Developer API (free tier).
//   3. Paste the firebaseConfig object below. Web config values are public by design;
//      restrict abuse with App Check + the Firebase console's API-key HTTP referrer limits.
export const firebaseConfig = null;
// export const firebaseConfig = {
//   apiKey: "...", authDomain: "...firebaseapp.com", projectId: "...", storageBucket: "...",
//   messagingSenderId: "...", appId: "..."
// };
