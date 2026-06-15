# GoalMatrix Local Web Server using native PowerShell and .NET HttpListener
# This allows loading ES6 modules without CORS issues, requiring no Node.js or Python.

$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  GoalMatrix Local Web Server is Running!" -ForegroundColor Green
Write-Host "  Open your browser and navigate to:" -ForegroundColor White
Write-Host "  http://localhost:$port/" -ForegroundColor Yellow -NoNewline
Write-Host " (Ctrl+Click to open)" -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C in this terminal to stop the server." -ForegroundColor Red
Write-Host "==================================================`n" -ForegroundColor Cyan

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $url = $request.RawUrl
        # Default document
        if ($url -eq "/" -or $url -eq "") { 
            $url = "/index.html" 
        }
        
        # Strip query strings
        if ($url.Contains("?")) {
            $url = $url.Substring(0, $url.IndexOf("?"))
        }
        
        # Clean URL path to local file path
        $cleanedUrl = $url.Replace("/", "\")
        $filePath = Join-Path (Get-Location) $cleanedUrl
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Identify MIME types
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "text/plain"
            if ($extension -eq ".html" -or $extension -eq ".htm") { $mime = "text/html" }
            elseif ($extension -eq ".css") { $mime = "text/css" }
            elseif ($extension -eq ".js") { $mime = "text/javascript" }
            elseif ($extension -eq ".json") { $mime = "application/json" }
            elseif ($extension -eq ".png") { $mime = "image/png" }
            elseif ($extension -eq ".jpg" -or $extension -eq ".jpeg") { $mime = "image/jpeg" }
            elseif ($extension -eq ".ico") { $mime = "image/x-icon" }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found: $url")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            Write-Host "404 - Not Found: $url" -ForegroundColor Red
        }
    } catch {
        # Log error but keep listening
        Write-Host "Server Error: $_" -ForegroundColor DarkRed
    } finally {
        if ($response) {
            $response.Close()
        }
    }
}
