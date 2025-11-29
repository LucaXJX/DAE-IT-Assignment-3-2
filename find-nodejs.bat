@echo off
REM 設置代碼頁為 UTF-8 以正確顯示中文
chcp 65001 >nul 2>&1

echo 正在查找 Node.js 安裝位置...
echo.

REM 檢查標準安裝位置
if exist "C:\Program Files\nodejs\node.exe" (
    echo ✅ 找到 Node.js: C:\Program Files\nodejs
    echo    Node.js 版本:
    "C:\Program Files\nodejs\node.exe" -v
    echo    npm 版本:
    "C:\Program Files\nodejs\npm.cmd" -v
    goto :end
)

REM 檢查 nvm-windows 常見位置
if exist "%APPDATA%\nvm\node.exe" (
    echo ✅ 找到 Node.js (nvm): %APPDATA%\nvm
    goto :end
)

REM 檢查環境變數
if not "%NVM_SYMLINK%"=="" (
    if exist "%NVM_SYMLINK%\node.exe" (
        echo ✅ 找到 Node.js (nvm symlink): %NVM_SYMLINK%
        goto :end
    )
)

REM 檢查當前 PATH 中的 Node.js
for %%P in (%PATH%) do (
    if exist "%%P\node.exe" (
        echo ✅ 在 PATH 中找到 Node.js: %%P
        goto :end
    )
)

echo ❌ 未找到 Node.js
echo.
echo 請檢查：
echo   1. Node.js 是否已安裝
echo   2. 如果使用 nvm-windows，請先運行 "nvm use <version>"
echo   3. Node.js 是否在系統 PATH 中

:end
pause

