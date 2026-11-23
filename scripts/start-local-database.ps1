param(
    [string]$Xampp = 'C:\xampp',
    [ValidateRange(1024, 65535)]
    [int]$Port = 3307
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$dataDirectory = [IO.Path]::GetFullPath((Join-Path $repository 'backend/storage/app/private/local-mariadb'))
$mysqlDirectory = (Resolve-Path -LiteralPath (Join-Path $Xampp 'mysql')).Path
$mysql = Join-Path $mysqlDirectory 'bin/mysql.exe'
$initializer = Join-Path $mysqlDirectory 'bin/mysql_install_db.exe'
$server = Join-Path $mysqlDirectory 'bin/mysqld.exe'
$client = @('--no-defaults', '--protocol=TCP', '--host=127.0.0.1', "--port=$Port", '--user=root', '--connect-timeout=8')

function Get-YerhDataDirectory {
    $answer = & $mysql @client --batch --raw --skip-column-names --execute='SELECT @@datadir' 2>$null
    if ($LASTEXITCODE -eq 0 -and $answer) {
        return [IO.Path]::GetFullPath($answer.Trim()).TrimEnd('\', '/')
    }
}

$running = Get-YerhDataDirectory
if ($running -and $running -ne $dataDirectory) {
    throw "Port $Port belongs to another database. Pick a free port and update backend/.env."
}
if (!$running) {
    if (!(Test-Path -LiteralPath (Join-Path $dataDirectory 'mysql'))) {
        if (Test-Path -LiteralPath $dataDirectory) {
            throw 'The YERH database directory exists but has no system tables. Inspect it before proceeding.'
        }
        & $initializer "--datadir=$dataDirectory" "--port=$Port"
        if ($LASTEXITCODE -ne 0) { throw 'MariaDB initialization failed.' }
    }
    $instance = Get-CimInstance Win32_Process -Filter "Name = 'mysqld.exe' OR Name = 'mariadbd.exe'" |
        Where-Object { $_.CommandLine -like "*$dataDirectory*" -and $_.CommandLine -match "--port=$Port(?:\s|$)" } |
        Select-Object -First 1
    if ($instance) {
        throw "YERH MariaDB is starting on port $Port. Wait a few seconds and run this command again."
    }
    $process = Start-Process -FilePath $server -ArgumentList @(
        '--no-defaults', ('--basedir="' + $mysqlDirectory + '"'),
        ('--datadir="' + $dataDirectory + '"'), "--port=$Port",
        '--bind-address=127.0.0.1', '--log-error=yerh-mariadb.log'
    ) -WorkingDirectory $mysqlDirectory -WindowStyle Hidden -PassThru

    foreach ($attempt in 1..12) {
        if ($process.HasExited) { throw "MariaDB exited. See $dataDirectory\yerh-mariadb.log." }
        $running = Get-YerhDataDirectory
        if ($running) { break }
        Start-Sleep -Seconds 1
    }
}
if ($running -ne $dataDirectory) { throw "The YERH database could not be verified on port $Port." }
& $mysql @client --execute='CREATE DATABASE IF NOT EXISTS yerh_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
if ($LASTEXITCODE -ne 0) { throw 'Could not open yerh_db.' }
Write-Output "YERH MariaDB is ready at 127.0.0.1:$Port."
