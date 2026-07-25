# AI Operations Agent V11

Pixel-matched enterprise landing page based on the approved visual.

## Included
- Full-screen 3D robot and digital globe visual
- Left navigation, connected status, command center access
- Dynamic response panel with Pause, Stop, Copy and Full Analysis
- Voice recognition and automatic spoken response
- Microphone interrupts current speech and starts the next question
- SLA, Incident, DevOps and Knowledge Base quick actions
- Existing Moveworks, ServiceNow, Azure DevOps and governance backend retained

## Deploy
1. Extract the package into the GitHub repository.
2. Commit and push to `main`.
3. Wait for Azure App Service deployment.
4. Hard refresh with Ctrl+Shift+R.
5. Verify `/health` reports version `11.4.0`.

Use Microsoft Edge or Google Chrome and allow microphone access.


## V11.1 visual fixes
- Removed the duplicate top-left sidebar logo.
- Expanded the robot/globe visual to the same width as the prompt bar.
- Kept the complete robot and globe visible without a portrait-shaped frame.


## V11.4 changes
- Removed the four bottom quick-action cards from the AI home page.
- Moved the voice/text prompt to the bottom to keep the robot legs visible.
- Increased the full-body robot presentation while preserving head-to-toe visibility.
- Added a CSS-rendered complete globe halo behind the clean robot image so the globe boundary stays visible on both left and right sides.


## V11.6
- Preserves V11.3 robot/globe position, size and scaling.
- Keeps V11.5 bottom cards removed.
- Moves only the desktop voice/text prompt down to 28px from the bottom so the robot legs and feet remain unobstructed.
