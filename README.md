# AI Operations Agent V10.4

This package keeps the existing Moveworks, ServiceNow, SLA governance, DevOps governance, assignment, notification, EOD reporting, dashboard callback and AI query features.

## V10.4 home-page updates

- Full-body 3D AI robot presented as one centered image
- No left-side crop or unwanted colour layer
- Subtle floating, glow and speaking-wave animations
- Greeting may overlap the image intentionally
- Voice question remains on the home page
- Voice answer is spoken automatically
- Pressing the microphone interrupts the current answer and begins listening again
- Pause, Stop, Copy, Close and View Full Analysis controls

## Deploy

Replace the files in your GitHub repository and push to `main`.

```bash
git add .
git commit -m "Deploy centered 3D AI Operations Agent V10.4"
git pull --rebase origin main
git push origin main
```

After Azure App Service deploys, hard refresh with `Ctrl + Shift + R`.

Verify `/health` returns version `10.5.0`.
