# 01 · Ollama setup on the zone gateway

Target: **Raspberry Pi 5 (8 GB)**, Raspberry Pi OS Lite 64-bit (Bookworm). The same steps work on any Linux x86/ARM mini-PC.

## Install

```bash
sudo apt update && sudo apt full-upgrade -y
curl -fsSL https://ollama.com/install.sh | sh     # installs the binary + systemd service
ollama --version
```

> Offline sites: download the install script and the `ollama-linux-arm64` release once on a connected laptop, copy them over by USB, and run the script with the local file.

## Pull a model (while you still have internet)

```bash
ollama pull llama3.2:3b        # ~2.0 GB, the default for Nura
ollama pull qwen2.5:1.5b       # ~1.0 GB, fallback for 4 GB boards
```

Models live in `/usr/share/ollama/.ollama/models`. To move them to another gateway, copy that folder.

## Bind to localhost only

Ollama must **not** be reachable from the street Wi-Fi.

```bash
sudo systemctl edit ollama
# add:
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_KEEP_ALIVE=30m"
Environment="OLLAMA_NUM_PARALLEL=1"
sudo systemctl restart ollama
```

## Smoke test

```bash
curl -s http://127.0.0.1:11434/api/chat -d '{
  "model": "llama3.2:3b",
  "stream": false,
  "format": "json",
  "options": {"temperature": 0.1},
  "messages": [
    {"role": "system", "content": "Reply only with JSON: {\"ok\": true}"},
    {"role": "user", "content": "ping"}
  ]
}' | python3 -m json.tool
```

Expect `"message": {"content": "{\"ok\": true}"}` in 2–8 s on a Pi 5.
