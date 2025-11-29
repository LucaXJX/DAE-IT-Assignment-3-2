@echo off
REM 設置代碼頁為 UTF-8 以正確顯示中文
chcp 65001 >nul 2>&1

REM 重建 @tensorflow/tfjs-node 原生模組
REM 
REM Node.js 路徑（如果自動查找失敗，取消註釋下面這行並修改路徑）：
set "NODEJS_DIR=C:\Program Files\nodejs"

echo ========================================
echo   編譯 @tensorflow/tfjs-node 原生模組
echo ========================================
echo.

REM 切換到專案目錄
cd /d "%~dp0"
echo [1/5] 當前目錄: %CD%
echo.

REM 檢查是否已經手動設置了 NODEJS_DIR
if not "%NODEJS_DIR%"=="" (
    echo [2/5] 使用設定的 Node.js 路徑: %NODEJS_DIR%
    if exist "%NODEJS_DIR%\node.exe" (
        echo ✅ 驗證路徑有效
        goto :found_nodejs
    ) else (
        echo ❌ 指定的 Node.js 路徑不存在: %NODEJS_DIR%
        echo 請檢查路徑或運行 "手動設置Node路徑.bat" 來查找正確的路徑
        pause
        exit /b 1
    )
)

REM 如果未設置，則自動查找 Node.js 和 npm 的位置
echo [2/5] 自動查找 Node.js 和 npm...

REM 嘗試從多個位置查找 Node.js
set "NODEJS_DIR="

REM 方法 1: 檢查標準安裝位置
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODEJS_DIR=C:\Program Files\nodejs"
    echo ✅ 找到 Node.js (標準安裝): %NODEJS_DIR%
    goto :found_nodejs
)

REM 方法 2: 檢查 nvm-windows 環境變數
if not "%NVM_SYMLINK%"=="" (
    if exist "%NVM_SYMLINK%\node.exe" (
        set "NODEJS_DIR=%NVM_SYMLINK%"
        echo ✅ 找到 Node.js (nvm symlink): %NODEJS_DIR%
        goto :found_nodejs
    )
)

REM 方法 3: 檢查 nvm-windows 安裝目錄（常用版本）
for /L %%V in (22,1,22) do (
    if exist "%APPDATA%\nvm\v%%V.17.1\node.exe" (
        set "NODEJS_DIR=%APPDATA%\nvm\v%%V.17.1"
        echo ✅ 找到 Node.js (nvm v%%V.17.1): %NODEJS_DIR%
        goto :found_nodejs
    )
)

REM 方法 4: 檢查 nvm-windows 的其他常見版本路徑
for %%V in (22.17.1 22.17.0 20.17.0 20.11.0 18.20.0) do (
    if exist "%APPDATA%\nvm\v%%V\node.exe" (
        set "NODEJS_DIR=%APPDATA%\nvm\v%%V"
        echo ✅ 找到 Node.js (nvm v%%V): %NODEJS_DIR%
        goto :found_nodejs
    )
)

REM 方法 5: 嘗試從系統 PATH 中查找
for %%P in (%PATH%) do (
    if exist "%%P\node.exe" (
        set "NODEJS_DIR=%%P"
        echo ✅ 在 PATH 中找到 Node.js: %%P
        goto :found_nodejs
    )
)

REM 如果都找不到，提示用戶
echo ❌ 無法自動找到 Node.js
echo.
echo 解決方案：
echo.
echo   方案 1（推薦）：運行查找腳本
echo     先運行 "手動設置Node路徑.bat" 來查找 Node.js 位置
echo     然後按照提示設置路徑
echo.
echo   方案 2：手動設置
echo     如果使用 nvm-windows，請先運行: nvm use <版本號>
echo     或者編輯此批處理文件，取消註釋並修改第 4-7 行的路徑設置
echo.
echo   方案 3：直接設置環境變數
echo     在 PowerShell 中運行:
echo     $env:NODEJS_DIR="你的Node.js路徑"
echo     然後運行此腳本
echo.
echo 常見位置：
echo   - 標準安裝: C:\Program Files\nodejs
echo   - nvm-windows: %APPDATA%\nvm\v<版本號>
echo   - 例如: %APPDATA%\nvm\v22.17.1
echo.
pause
exit /b 1

:found_nodejs
REM 將 Node.js 添加到 PATH
set "PATH=%NODEJS_DIR%;%PATH%"

REM 驗證 Node.js 和 npm
echo 驗證 Node.js 安裝...
"%NODEJS_DIR%\node.exe" -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 不可用
    pause
    exit /b 1
)
"%NODEJS_DIR%\node.exe" -v

if exist "%NODEJS_DIR%\npm.cmd" (
    "%NODEJS_DIR%\npm.cmd" -v >nul 2>&1
    if errorlevel 1 (
        echo 警告：npm 版本檢查失敗，但繼續嘗試...
    ) else (
        echo Node.js 和 npm 驗證成功
    )
) else if exist "%NODEJS_DIR%\npm" (
    "%NODEJS_DIR%\npm" -v >nul 2>&1
    if errorlevel 1 (
        echo 警告：npm 版本檢查失敗，但繼續嘗試...
    ) else (
        echo Node.js 和 npm 驗證成功
    )
) else (
    echo 警告：npm 可能不可用，但繼續嘗試...
)

echo.
echo Node.js 路徑: %NODEJS_DIR%
echo.
echo ========================================
echo 準備設置 Visual Studio 環境變數...
echo ========================================
echo.
echo 正在檢查腳本是否繼續執行...
REM 強制繼續執行
goto :continue_vs

:continue_vs

REM 設置 Visual Studio 環境變數
echo [3/5] 設置 Visual Studio 環境變數...
echo.
set "VS_BATCH=D:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
echo 正在檢查 Visual Studio 環境設置腳本...
echo 路徑: %VS_BATCH%
if not exist "%VS_BATCH%" (
    echo Visual Studio 環境設置腳本不存在
    echo 請確認 Visual Studio 安裝路徑是否正確
    pause
    exit /b 1
)
echo Visual Studio 環境設置腳本存在，正在調用...
call "%VS_BATCH%"
if errorlevel 1 (
    echo 無法設置 Visual Studio 環境變數
    echo 請確認 Visual Studio 安裝路徑是否正確
    pause
    exit /b 1
)
echo Visual Studio 環境變數設置完成
echo.

REM 重新添加 Node.js 到 PATH（Visual Studio 可能重置了 PATH）
echo [4/5] 恢復 Node.js 路徑...
set "PATH=%NODEJS_DIR%;%PATH%"
echo ✅ Node.js 路徑已恢復
echo.

REM 重建原生模組
echo [5/5] 開始編譯原生模組...
echo 這可能需要 5-10 分鐘，請耐心等待...
echo.
npm rebuild @tensorflow/tfjs-node --build-from-source

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 編譯成功！
    echo ========================================
    echo.
    echo 🎉 現在可以運行訓練了：
    echo    npm run train
    echo.
) else (
    echo.
    echo ========================================
    echo   ❌ 編譯失敗
    echo ========================================
    echo.
    echo 請檢查上面的錯誤信息
    echo 常見問題：
    echo   - 確認已安裝 "Desktop development with C++" 工作負載
    echo   - 確認 Python 已安裝並在 PATH 中
    echo   - 確認 Visual Studio 路徑正確
    echo.
)

pause

