@echo off
chcp 65001 >nul 2>&1

echo ========================================
echo   編譯 @tensorflow/tfjs-node 原生模組
echo ========================================
echo.

cd /d "%~dp0"
echo [1/5] 當前目錄: %CD%
echo.

set "NODEJS_DIR=C:\Program Files\nodejs"
echo [2/5] 使用設定的 Node.js 路徑: %NODEJS_DIR%
if not exist "%NODEJS_DIR%\node.exe" (
    echo 錯誤：Node.js 路徑不存在
    pause
    exit /b 1
)
echo 驗證路徑有效
echo.

echo 驗證 Node.js 安裝...
"%NODEJS_DIR%\node.exe" -v
echo Node.js 和 npm 驗證成功
echo.

echo ========================================
echo 準備設置 Visual Studio 環境變數...
echo ========================================
echo.

echo [3/5] 設置 Visual Studio 環境變數...
set "VS_BATCH=D:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
echo 正在檢查 Visual Studio 環境設置腳本...
if not exist "%VS_BATCH%" (
    echo 錯誤：Visual Studio 環境設置腳本不存在
    pause
    exit /b 1
)
echo Visual Studio 環境設置腳本存在，正在調用...
call "%VS_BATCH%"
if errorlevel 1 (
    echo 錯誤：無法設置 Visual Studio 環境變數
    pause
    exit /b 1
)
echo Visual Studio 環境變數設置完成

REM 設置 node-gyp 使用 Visual Studio 2022 配置（VS 2026 基於 VS 2022）
echo 配置 node-gyp 使用 Visual Studio 2022 配置...
set GYP_MSVS_VERSION=2022
set npm_config_msvs_version=2022
set GYP_MSVS_OVERRIDE_PATH=D:\Program Files\Microsoft Visual Studio\18\Community
REM 設置 Visual Studio 版本為 17.0（VS 2022）
set VisualStudioVersion=17.0
set VSINSTALLDIR=D:\Program Files\Microsoft Visual Studio\18\Community
echo node-gyp 已配置為使用 Visual Studio 2022 配置（VS 2026）
echo.

echo [4/5] 恢復 Node.js 路徑...
set "PATH=%NODEJS_DIR%;%PATH%"
echo Node.js 路徑已恢復
echo.

echo [5/5] 開始編譯原生模組...
echo 這可能需要 5-10 分鐘，請耐心等待...
echo.
npm rebuild @tensorflow/tfjs-node --build-from-source

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   編譯成功！
    echo ========================================
    echo.
    echo 現在可以運行訓練了：npm run train
    echo.
) else (
    echo.
    echo ========================================
    echo   編譯失敗
    echo ========================================
    echo.
    echo 請檢查上面的錯誤信息
    echo.
)

pause

