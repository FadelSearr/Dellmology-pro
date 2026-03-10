Run the auto-prompt hooks runner

1. Install dependencies (recommended in a venv):

```bash
python -m pip install -r scripts/requirements.txt
```

2. Run the runner (example):

```bash
python scripts/run_auto_prompts.py --config .github/auto-prompts.yml
```

Notes
- The script is intentionally minimal. To integrate with a real agent, implement a subclass of `AgentInterface` in `scripts/run_auto_prompts.py` and wire it to your agent SDK/CLI.
- If a hook indicates code changes or the config sets `requires_confirmation_for_commits: true`, the runner will create a file under `.github/auto-prompts-pending/` for manual review and commit.
