# 07 · Edge deployment

## Custom Modelfile (bakes in the system prompt and settings)

```dockerfile
# /opt/nura/Modelfile
FROM llama3.2:3b
PARAMETER temperature 0.1
PARAMETER num_ctx 2048
PARAMETER seed 7
SYSTEM """<contents of ai/04 system prompt>"""
```

```bash
ollama create nura-diag -f /opt/nura/Modelfile
ollama run nura-diag "test"   # sanity check
```

Then `nebo-ai` calls `"model": "nura-diag"`, and the prompt can't drift between services.

## systemd unit

```ini
# /etc/systemd/system/nebo-ai.service
[Unit]
Description=Nura AI diagnosis worker
After=ollama.service nebo-rules.service
Requires=ollama.service

[Service]
User=nura
WorkingDirectory=/opt/nura
ExecStart=/opt/nura/venv/bin/python -m nebo.ai
Restart=always
RestartSec=5
Environment=OLLAMA_URL=http://127.0.0.1:11434
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/nura

[Install]
WantedBy=multi-user.target
```

## Heat and power

- A Pi 5 throttles at 85 °C. Sahel enclosures reach 60 °C+ ambient, so use the **active cooler**, a vented enclosure with a dust filter, shade and a light-coloured box.
- Keep `OLLAMA_KEEP_ALIVE=30m`. Loading the model costs about 10 s and some watts, and incidents cluster.
- If the gateway battery drops below 30%, `nebo-ai` skips the model and uses the signature fallback. Dispatch never waits for AI.

## Offline updates

1. On a connected laptop: `ollama pull <model>`, then copy `~/.ollama/models` and the new `nebo` wheel to a USB stick.
2. On the gateway: stop the services, rsync the models, `pip install` the wheel, `ollama create nura-diag`, then run the evaluation set (guide 02). Only switch over if the scores hold.

## Benchmark on your hardware

```bash
time curl -s http://127.0.0.1:11434/api/chat -d @sample-incident.json > /dev/null
ollama ps     # shows memory use and whether the model is loaded
```
