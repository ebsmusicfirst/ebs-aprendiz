# Ativa Claude Sonnet (direto — sem proxy)
# Uso: para escrita de copy, conteúdo, textos dos slides

$settingsPath = "C:\Users\alexr\.claude\settings.json"
$settings = Get-Content $settingsPath | ConvertFrom-Json

# Remove o redirecionamento para o proxy
$env_obj = $settings.env
$env_obj.PSObject.Properties.Remove("ANTHROPIC_BASE_URL")
$env_obj.PSObject.Properties.Remove("ANTHROPIC_AUTH_TOKEN")

$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
Write-Host "✅ Modelo: Claude Sonnet (direto, sem proxy)"
Write-Host "   Reinicie o Claude Code para aplicar."
