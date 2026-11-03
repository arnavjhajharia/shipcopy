# ShipCopy demo video (strategist s34, 2026-11-03)
`shipcopy-demo.mp4`: 45 s, 1920x1080, captioned, silent track. It was built from 5 real screenshots of the LIVE app in the owner's Chrome.
1. Intro: the status panel (on-device / cloud / network).
2. Sample changelog, Auto policy. Gemini Nano is still downloading on this Mac, so it goes to the cloud (~3 s, streamed) with that reason on the badge. Regenerate/Copy shown per block.
3. A ~6.5k-token git log, Auto. It goes to the cloud because it "exceeds the on-device budget (6000)".
4. On-device only + oversized input: it refuses with a clear reason and never silently goes to the cloud.
5. Closing: copy-all/.md, local history, and the note that with Nano ready, small inputs run on-device.
Re-shot 14:1x against ed92df2 (builder streaming + copy-all + regenerate + history). Re-shoot again if the UI changes before the owner submits.
HONEST GAP: the on-device path is not shown. This Mac has ~4 GB free and Nano needs ~22 GB. If the owner records on a machine with Nano ready, re-shoot step 2 for the ⚡ badge.
Headless Chrome cannot record this: reCAPTCHA Enterprise App Check returns 403 and then throttles for 24 h (rec.mjs keeps it as a tool for other apps).
Rebuild: `bash build.sh`. Devpost wants a YouTube/Vimeo link, so the owner (or distributor, via the owner's YouTube) uploads this file.
