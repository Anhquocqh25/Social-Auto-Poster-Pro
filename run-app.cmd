@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "ENV_LOCAL_PATH=%REPO_ROOT%\.env.local"
set "ENV_EXAMPLE_PATH=%REPO_ROOT%\.env.example"
set "PRISMA_DB_PATH=%REPO_ROOT%\prisma\dev.db"
set "MIN_NODE_MAJOR=20"

call :detect_repo_root
call :require_command node || exit /b 1
call :require_command npm || exit /b 1
call :check_node_version || exit /b 1
call :ensure_dependencies || exit /b 1
call :ensure_prisma_client || exit /b 1
call :ensure_env_local || exit /b 1
call :ensure_safe_publish_flag || exit /b 1
call :ensure_dev_database || exit /b 1
call :start_app || exit /b 1
exit /b 0

:log
echo [run-app] %~1
exit /b 0

:fail
echo [run-app] LOI: %~1 1>&2
exit /b 1

:require_command
where %~1 >nul 2>nul || (
  call :fail "Khong tim thay lenh '%~1'. Hay cai dat truoc khi chay ung dung."
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

:ensure_dependencies
if not exist "%REPO_ROOT%\node_modules" (
  call :log "Chua co node_modules. Dang chay npm ci..."
  call npm ci || (
    call :fail "npm ci that bai."
    exit /b 1
  )
) else (
  call :log "Da co node_modules. Bo qua npm ci."
)
exit /b 0

:ensure_prisma_client
call :log "Dang tao Prisma Client..."
call npx prisma generate || (
  call :fail "Khong the tao Prisma Client."
  exit /b 1
)
exit /b 0

:ensure_env_local
if exist "%ENV_LOCAL_PATH%" (
  call :log "Da tim thay .env.local. Se dung cau hinh hien co."
  exit /b 0
)
if not exist "%ENV_EXAMPLE_PATH%" (
  call :fail "Thieu .env.local va cung khong co .env.example de tao mau cau hinh."
  exit /b 1
)
copy /Y "%ENV_EXAMPLE_PATH%" "%ENV_LOCAL_PATH%" >nul || (
  call :fail "Khong the tao .env.local tu .env.example."
  exit /b 1
)
call :log "Da tao .env.local tu .env.example."
call :log "Hay nhap thu cong thong tin Facebook/OAuth that vao .env.local neu ban can ket noi that."
exit /b 0

:ensure_safe_publish_flag
findstr /R /C:"^[ ]*FACEBOOK_REAL_PUBLISH_ENABLED=" "%ENV_LOCAL_PATH%" >nul
if errorlevel 1 (
  >>"%ENV_LOCAL_PATH%" echo.
  >>"%ENV_LOCAL_PATH%" echo FACEBOOK_REAL_PUBLISH_ENABLED=false
  call :log "Da them FACEBOOK_REAL_PUBLISH_ENABLED=false vao .env.local."
) else (
  for /f "tokens=1,* delims==" %%A in ('findstr /R /C:"^[ ]*FACEBOOK_REAL_PUBLISH_ENABLED=" "%ENV_LOCAL_PATH%"') do set "REAL_FLAG=%%B"
  set "REAL_FLAG=!REAL_FLAG: =!"
  if /I not "!REAL_FLAG!"=="false" (
    call :fail "FACEBOOK_REAL_PUBLISH_ENABLED trong .env.local phai la false de chay an toan. Gia tri hien tai: !REAL_FLAG!"
    exit /b 1
  )
  call :log "Da xac minh FACEBOOK_REAL_PUBLISH_ENABLED=false trong .env.local."
)
set "FACEBOOK_REAL_PUBLISH_ENABLED=false"
exit /b 0

:ensure_dev_database
if exist "%PRISMA_DB_PATH%" (
  call :log "Da tim thay co so du lieu cuc bo tai prisma\dev.db. Khong ghi de."
  exit /b 0
)
call :log "Chua co prisma\dev.db. Dang khoi tao co so du lieu phat trien moi bang prisma db push..."
call npx prisma db push --skip-generate || (
  call :fail "Khong the khoi tao co so du lieu phat trien moi."
  exit /b 1
)
if not exist "%PRISMA_DB_PATH%" (
  call :fail "Prisma bao thanh cong nhung prisma\dev.db chua duoc tao."
  exit /b 1
)
call :log "Da khoi tao co so du lieu phat trien moi tai prisma\dev.db."
exit /b 0

:start_app
call :log "Dang khoi dong ung dung o che do phat trien an toan..."
call npm run dev
exit /b %ERRORLEVEL%