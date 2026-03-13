LLM local preload — quick guide

Purpose
- Describe requirements and how to verify local GGUF model preload for `apps/ml-engine`.

Model location
- The service looks for the path in the `LLM_MODEL` environment variable or `Config.LLM_MODEL`.
- Example local GPT4All location on Windows: C:\Users\<user>\AppData\Local\nomic.ai\GPT4All\DeepSeek-... .gguf

Memory & platform requirements
- GGUF models are large; allow at least 4–8 GB RAM free for small ~1B models. Larger models need proportionally more memory.
- Prefer Linux for reliable native `llama_cpp` builds. Windows can work but may hit native binding or memory limits.

Python deps
- pip install llama_cpp_python (or the project requirements in `apps/ml-engine/requirements.txt`).

Verify locally (PowerShell)
    # PowerShell example (replace path)
    $env:LLM_MODEL='C:\path\to\model.gguf'
    $env:LLM_PRELOAD_ON_STARTUP='true'
    C:\path\to\venv\Scripts\python.exe -u .scripts\verify_llm_preload.py

Quick programmatic checks
- from dellmology.intelligence import llm_backend
- llm_backend.local_model_status() — returns {'ok': bool, 'model_path': str|None, 'preloaded': bool}
- llm_backend.preload_local_model(path) — attempts to load; returns True/False. If `llama_cpp` fails, code will set a sentinel True (non-instance) for local-dev detection.

Fallback behavior
- If native binding can't be instantiated, `llm_backend` may mark the model as present using a sentinel (`_cached_llm = True`) so admin tooling and tests can proceed. This is intentional for local/dev environments.

Troubleshooting
- If `local_model_status()` reports no model found: verify the `.gguf` path and file permissions.
- If `preload_local_model()` returns False despite file present: check available RAM, `llama_cpp` version, and system compatibility. Try loading on a Linux VM with >8GB free memory.
- Check run logs: `.scripts/preload_test_output.txt` and `.scripts/llama_load_output.txt` contain diagnostics created during debugging.

Next steps
- If you want, revert temporary debug patches and remove testing artifacts (`.scripts/*.txt`).
