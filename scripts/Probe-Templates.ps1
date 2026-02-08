# Probe-Templates.ps1
# Probe backend public template endpoints and print ISO timestamps.
# Usage: .\Probe-Templates.ps1 [event-slug]

$apiBase = $env:API_BASE; if (-not $apiBase) { $apiBase = "https://digitalguestbook.onrender.com" }
$event = if ($args.Count -gt 0) { $args[0] } else { "huggel-and-bridget" }
$endpoints = @("invitation","guestbook","guestbook/video","rsvp","booth/photo","thanks","live","ended")

foreach ($ep in $endpoints) {
  $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $url = "$apiBase/api/public/event/$event/$ep"
  Write-Output "[$ts] GET $url"
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    $content = $res.Content
    $len = [Math]::Min(1200, $content.Length)
    Write-Output $content.Substring(0,$len)
  } catch {
    Write-Output "REQUEST FAILED: $($_.Exception.Message)"
  }
  Write-Output "`n---`n"
  Start-Sleep -Milliseconds 500
}
