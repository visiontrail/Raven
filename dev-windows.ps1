# Cherry Studio - Windows PowerShell Development Script
# 使用方法: .\dev-windows.ps1 或者在PowerShell中直接运行

param(
    [string]$Command = ""
)

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "   Cherry Studio - Windows Dev Menu  " -ForegroundColor Cyan  
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Install Dependencies" -ForegroundColor Green
    Write-Host "2. Start Development Mode" -ForegroundColor Green
    Write-Host "3. Start Debug Mode" -ForegroundColor Green
    Write-Host "4. Build for Windows x64" -ForegroundColor Yellow
    Write-Host "5. Build for Windows ARM64" -ForegroundColor Yellow
    Write-Host "6. Build (Unpack - No Installer)" -ForegroundColor Yellow
    Write-Host "7. Run Tests" -ForegroundColor Magenta
    Write-Host "8. Code Format & Lint" -ForegroundColor Blue
    Write-Host "9. Type Check" -ForegroundColor Blue
    Write-Host "0. Exit" -ForegroundColor Red
    Write-Host ""
}

function Install-Dependencies {
    Write-Host "Installing dependencies..." -ForegroundColor Green
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
    }
}

function Start-Development {
    Write-Host "Starting development mode..." -ForegroundColor Green
    npm run dev
}

function Start-Debug {
    Write-Host "Starting debug mode..." -ForegroundColor Green
    Write-Host "After startup, open chrome://inspect in your browser" -ForegroundColor Yellow
    npm run debug
}

function Build-WindowsX64 {
    Write-Host "Building Windows x64 version..." -ForegroundColor Yellow
    npm run build:win:x64
}

function Build-WindowsArm64 {
    Write-Host "Building Windows ARM64 version..." -ForegroundColor Yellow
    npm run build:win:arm64
}

function Build-Unpack {
    Write-Host "Building (unpack mode)..." -ForegroundColor Yellow
    npm run build:unpack
}

function Run-Tests {
    Write-Host "Running tests..." -ForegroundColor Magenta
    npm run test
}

function Format-Code {
    Write-Host "Formatting and linting code..." -ForegroundColor Blue
    npm run format
    npm run lint
}

function Check-Types {
    Write-Host "Running type check..." -ForegroundColor Blue
    npm run typecheck
}

# 直接命令模式
if ($Command -ne "") {
    switch ($Command.ToLower()) {
        "install" { Install-Dependencies; return }
        "dev" { Start-Development; return }
        "debug" { Start-Debug; return }
        "build-x64" { Build-WindowsX64; return }
        "build-arm64" { Build-WindowsArm64; return }
        "build-unpack" { Build-Unpack; return }
        "test" { Run-Tests; return }
        "format" { Format-Code; return }
        "typecheck" { Check-Types; return }
        default { 
            Write-Host "Unknown command: $Command" -ForegroundColor Red
            Write-Host "Available commands: install, dev, debug, build-x64, build-arm64, build-unpack, test, format, typecheck" -ForegroundColor Yellow
            return
        }
    }
}

# 交互模式
while ($true) {
    Show-Menu
    $choice = Read-Host "Please select an option (0-9)"
    
    switch ($choice) {
        "1" { Install-Dependencies; Read-Host "Press Enter to continue" }
        "2" { Start-Development; Read-Host "Press Enter to continue" }
        "3" { Start-Debug; Read-Host "Press Enter to continue" }
        "4" { Build-WindowsX64; Read-Host "Press Enter to continue" }
        "5" { Build-WindowsArm64; Read-Host "Press Enter to continue" }
        "6" { Build-Unpack; Read-Host "Press Enter to continue" }
        "7" { Run-Tests; Read-Host "Press Enter to continue" }
        "8" { Format-Code; Read-Host "Press Enter to continue" }
        "9" { Check-Types; Read-Host "Press Enter to continue" }
        "0" { 
            Write-Host "Goodbye!" -ForegroundColor Green
            exit 
        }
        default { 
            Write-Host "Invalid option. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
} 