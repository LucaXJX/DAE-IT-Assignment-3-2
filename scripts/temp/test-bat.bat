@echo off
REM 設置代碼頁為 UTF-8 以正確顯示中文
chcp 65001 >nul 2>&1

echo 測試腳本開始...
echo.
echo 步驟 1: 設置 Node.js 路徑
set "NODEJS_DIR=C:\Program Files\nodejs"
echo Node.js 路徑: %NODEJS_DIR%
echo.

echo 步驟 2: 驗證 Node.js
if exist "%NODEJS_DIR%\node.exe" (
    echo ✅ Node.js 存在
    "%NODEJS_DIR%\node.exe" -v
) else (
    echo ❌ Node.js 不存在
    pause
    exit /b 1
)
echo.

echo 步驟 3: 測試 Visual Studio 環境設置
echo 正在調用 Visual Studio 環境設置...
if exist "D:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
    echo ✅ Visual Studio 腳本存在
    call "D:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
    if errorlevel 1 (
        echo ❌ Visual Studio 環境設置失敗
    ) else (
        echo ✅ Visual Studio 環境設置成功
    )
) else (
    echo ❌ Visual Studio 腳本不存在
)
echo.

echo 步驟 4: 恢復 Node.js 路徑
set "PATH=%NODEJS_DIR%;%PATH%"
echo ✅ 路徑已恢復
echo.

echo 步驟 5: 測試 npm
npm -v
echo.

echo 測試完成！
pause

