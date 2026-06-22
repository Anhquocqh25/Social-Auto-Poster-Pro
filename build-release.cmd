@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "RELEASE_DIR=%REPO_ROOT%\release"
set "FINAL_DIR=%REPO_ROOT%\release\final"
set "MIN_NODE_MAJOR=20"

call :detect_repo_root
call :require_command node || exit /b 1
call :require_command npm || exit /b 1
call :require_command certutil || exit /b 1
call :check_node_version || exit /b 1
call :prepare_release_dir || exit /b 1
call :install_dependencies || exit /b 1
call :generate_prisma_client || exit /b 1
call :run_typecheck || exit /b 1
call :run_build || exit /b 1
call :collect_artifacts || exit /b 1
call :generate_checksums || exit /b 1
call :print_artifacts || exit /b 1
call :log "Hoan tat build release Windows. Artifact cuoi cung nam trong release\final."
exit /b 0

:log
echo [build-release] %~1
exit /b 0

:fail
echo [build-release] LOI: %~1 1>&2
exit /b 1

:require_command
where %~1 >nul 2>nul || (
  call :fail "Khong tim thay lenh '%~1'. Hay cai dat truoc khi build release."
  exit /b 1
)
exit /b 0

:detect_repo_root
if not exist "%REPO_ROOT%\package.json" (
  call :fail "Khong xac dinh duoc thu muc goc cua du an."
  exit /b 1
)
if not exist "%REPO_ROOT%\src" (
  call :fail "Khong xac dinh duoc thu muc src cua du an."
  exit /b 1
)
if not exist "%REPO_ROOT%\electron" (
  call :fail "Khong xac dinh duoc thu muc electron cua du an."
  exit /b 1
)
exit /b 0

:check_node_version
for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
  call :fail "Khong doc duoc phien ban Node.js."
  exit /b 1
)
if %NODE_MAJOR% LSS %MIN_NODE_MAJOR% (
  call :fail "Node.js hien tai khong duoc ho tro. Yeu cau Node.js >= %MIN_NODE_MAJOR%."
  exit /b 1
)
exit /b 0

:prepare_release_dir
if not exist "%FINAL_DIR%" mkdir "%FINAL_DIR%" || (
  call :fail "Khong the tao thu muc release\final."
  exit /b 1
)
del /Q "%FINAL_DIR%\*.exe" "%FINAL_DIR%\*.blockmap" "%FINAL_DIR%\SHA256SUMS.txt" >nul 2>nul
exit /b 0

:install_dependencies
call :log "Dang chay npm ci..."
call npm ci || (
  call :fail "npm ci that bai."
  exit /b 1
)
exit /b 0

:generate_prisma_client
call :log "Dang tao Prisma Client..."
call npx prisma generate || (
  call :fail "Khong the tao Prisma Client."
  exit /b 1
)
exit /b 0

:run_typecheck
call :log "Dang kiem tra TypeScript..."
call npx tsc --noEmit || (
  call :fail "TypeScript kiem tra that bai."
  exit /b 1
)
exit /b 0

:run_build
call :log "Dang build ung dung va dong goi Electron cho Windows NSIS..."
call npm run build || (
  call :fail "Build/packaging that bai. Tren Windows, electron-builder co the can quyen tao symlink hoac Developer Mode."
  exit /b 1
)
exit /b 0

:collect_artifacts
set "FOUND=0"
for %%F in ("%RELEASE_DIR%\*.exe") do (
  if exist "%%~fF" (
    copy /Y "%%~fF" "%FINAL_DIR%\" >nul || (
      call :fail "Khong the sao chep artifact %%~nxF vao release\final."
      exit /b 1
    )
    set "FOUND=1"
  )
)
for %%F in ("%RELEASE_DIR%\*.blockmap") do (
  if exist "%%~fF" (
    copy /Y "%%~fF" "%FINAL_DIR%\" >nul || (
      call :fail "Khong the sao chep blockmap %%~nxF vao release\final."
      exit /b 1
    )
  )
)
if "%FOUND%"=="0" (
  call :fail "Khong tim thay artifact Windows duoc cau hinh (.exe) trong thu muc release."
  exit /b 1
)
exit /b 0

:generate_checksums
call :log "Dang tao checksum SHA256..."
break > "%FINAL_DIR%\SHA256SUMS.txt" || (
  call :fail "Khong the tao file SHA256SUMS.txt."
  exit /b 1
)
for %%F in ("%FINAL_DIR%\*.exe") do (
  if exist "%%~fF" (
    >>"%FINAL_DIR%\SHA256SUMS.txt" echo ==== %%~nxF ====
    certutil -hashfile "%%~fF" SHA256 | findstr /R /V /C:"hash of file" /C:"CertUtil:" >> "%FINAL_DIR%\SHA256SUMS.txt" || (
      call :fail "Khong the tao checksum cho %%~nxF."
      exit /b 1
    )
  )
)
exit /b 0

:print_artifacts
for %%F in ("%FINAL_DIR%\*.exe") do (
  if exist "%%~fF" (
    echo [build-release] ARTIFACT: %%~nxF ^| PATH: %%~fF ^| SIZE_BYTES: %%~zF
  )
)
exit /b 0