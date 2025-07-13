# PowerShell script to test PPTX extraction API endpoint

param(
    [string]$FilePath = "sample.pptx",
    [string]$Url = "http://localhost:3000/api/extract-text"
)

if (-Not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$fileBytes = [System.IO.File]::ReadAllBytes($FilePath)
$fileContent = [System.Text.Encoding]::Default.GetString($fileBytes)

$bodyLines = @(
    "--$boundary"
    "Content-Disposition: form-data; name=`"file`"; filename=`"$FilePath`""
    "Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ""
    $fileContent
    "--$boundary--"
    ""
)

$body = [System.Text.Encoding]::Default.GetBytes(($bodyLines -join $LF))

$response = Invoke-RestMethod -Uri $Url -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $body

Write-Output "Response from API:"
Write-Output $response
