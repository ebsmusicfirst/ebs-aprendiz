# Ativa DeepSeek R1 via proxy LiteLLM
# Uso: para tarefas de código, dev, lógica

$settingsPath = "C:\Users\alexr\.claude\settings.json"
$settings = Get-Content $settingsPath | ConvertFrom-Json

$settings.env | Add-Member -Force -NotePropertyName "ANTHROPIC_BASE_URL" -NotePropertyValue "http://localhost:4000"
$settings.env | Add-Member -Force -NotePropertyName "ANTHROPIC_AUTH_TOKEN" -NotePropertyValue "sk-aiox-local"

$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
Write-Host "✅ Modelo: DeepSeek R1 (via proxy localhost:4000)"
Write-Host "   Reinicie o Claude Code para aplicar."
