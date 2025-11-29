@echo off
REM 設置代碼頁為 UTF-8 以正確顯示中文
chcp 65001 >nul 2>&1

REM 這個腳本可以幫助你找到 Node.js 並設置路徑

echo ========================================
echo   Node.js 路徑查找工具
echo ========================================
echo.

REM 檢查多個可能的 Node.js 位置
echo 正在查找 Node.js...
echo.

set "NODEJS_PATH="

REM 檢查標準安裝位置
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODEJS_PATH=C:\Program Files\nodejs"
    echo [1] ✅ 找到標準安裝: %NODEJS_PATH%
    goto :found
)

REM 檢查 Program Files (x86)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODEJS_PATH=C:\Program Files (x86)\nodejs"
    echo [2] ✅ 找到標準安裝 (x86): %NODEJS_PATH%
    goto :found
)

REM 檢查 nvm-windows 的環境變數
if not "%NVM_SYMLINK%"=="" (
    if exist "%NVM_SYMLINK%\node.exe" (
        set "NODEJS_PATH=%NVM_SYMLINK%"
        echo [3] ✅ 找到 nvm symlink: %NODEJS_PATH%
        goto :found
    )
)

REM 檢查 nvm-windows 常見版本
for %%V in (22.17.1 22.17.0 22.16.0 20.17.0 20.11.0 18.20.0) do (
    if exist "%APPDATA%\nvm\v%%V\node.exe" (
        set "NODEJS_PATH=%APPDATA%\nvm\v%%V"
        echo [4] ✅ 找到 nvm 版本 v%%V: %NODEJS_PATH%
        goto :found
    )
)

REM 檢查用戶目錄下的 nvm
if exist "%USERPROFILE%\AppData\Roaming\nvm\node.exe" (
    set "NODEJS_PATH=%USERPROFILE%\AppData\Roaming\nvm"
    echo [5] ✅ 找到 nvm: %NODEJS_PATH%
    goto :found
)

echo ❌ 未找到 Node.js
echo.
echo 請手動輸入 Node.js 安裝路徑（或按 Enter 退出）:
set /p "NODEJS_PATH=Node.js 路徑: "
if "%NODEJS_PATH%"=="" exit /b 1

if not exist "%NODEJS_PATH%\node.exe" (
    echo ❌ 路徑不正確：%NODEJS_PATH%\node.exe 不存在
    pause
    exit /b 1
)

:found
echo.
echo ========================================
echo   Node.js 路徑: %NODEJS_PATH%
echo ========================================
echo.

"%NODEJS_PATH%\node.exe" -v
if exist "%NODEJS_PATH%\npm.cmd" (
    "%NODEJS_PATH%\npm.cmd" -v
) else if exist "%NODEJS_PATH%\npm" (
    "%NODEJS_PATH%\npm" -v
)

echo.
echo ========================================
echo   使用方法
echo ========================================
echo.
echo 請將以下行添加到 rebuild-tfjs-node.bat 的開頭
echo （在 "REM 切換到專案目錄" 之前）:
echo.
echo set "NODEJS_DIR=%NODEJS_PATH%"
echo.
echo 或者直接運行以下命令：
echo set "NODEJS_DIR=%NODEJS_PATH%" ^&^& .\rebuild-tfjs-node.bat
echo.
pause

