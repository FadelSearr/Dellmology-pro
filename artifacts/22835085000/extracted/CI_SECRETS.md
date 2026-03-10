# CI / GitHub Secrets Reference

This file documents repository secrets expected by CI workflows and the ML engine.

Recommended GitHub secret names and purpose:

- `TELEGRAM_BOT_TOKEN`: Telegram Bot API token (used by the notifier). Keep secret.
- `TELEGRAM_CHAT_ID`: Chat id or channel name where the bot should post (string).
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key used for applying migrations and admin tasks.
- `WEB_ADMIN_KEY`: Key used by CI to authenticate artifact or dashboard uploads to the frontend.
- `SNAPSHOT_ADMIN_KEY`: Admin key for snapshot endpoints (used by some CI tasks).
- `MODEL_METRICS_ADMIN_KEY`: Key used by CI to publish model metrics.

Guidance:

- Do NOT store real secrets in the repository. Use the GitHub repository
  Settings → Secrets → Actions to add these values.
- When a workflow needs a secret, reference it in the workflow as
  `secrets.TELEGRAM_BOT_TOKEN` (for example).
- For local development, prefer copying `.env.example` to `.env` and filling
  in values; keep `.env` out of version control.

Troubleshooting CI artifacts:

- If CI runs fail to upload artifacts, confirm that `actions/upload-artifact`
  steps are present and that the runner has write access to the artifact paths.
- Use the `ci_health_check.py` script (in `apps/ml-engine/scripts`) to
  surface environment diagnostics early in the workflow.
