Saudi-Yemen Situation Monitor (Netlify)
Folder layout:
  public/index.html                 the dashboard
  netlify/functions/api.mjs         the X connection (keeps your token private)
  netlify.toml                      Netlify settings
Environment variables to add in Netlify:
  X_BEARER_TOKEN  = your X Bearer token
  TEAM_PASSWORD   = (optional) a password
