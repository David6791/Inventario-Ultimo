<#
=============================================================================
 Agente del escáner — Sistema de gestión (recepción de cargas)

 El navegador no puede manejar un escáner USB. Este programa corre en la PC
 de recepción, escucha SOLO en http://127.0.0.1:9123 (no se ve desde la red)
 y escanea cuando el sistema se lo pide. Usa WIA, el controlador de imágenes
 que trae Windows: sirve cualquier escáner que funcione con «Fax y Escáner de
 Windows».

   GET  /estado                      -> escáneres conectados
   POST /escanear?dpi=300&color=1    -> la imagen (JPG)
        &dispositivo=<id>               (opcional; si no, el primero)

 Solo responde a páginas del sistema: localhost, IP de la red local o el
 dominio de la empresa (ver $OrigenesPermitidos).

 Instalación: instalar-agente.cmd (arranca solo al iniciar sesión).
 Prueba sin escáner: $env:ESCANER_SIMULADO = 'C:\ruta\boleta.jpg'
=============================================================================
#>

param(
    [int]$Puerto = 9123,
    [int]$DpiPorDefecto = 300
)

$ErrorActionPreference = 'Stop'
$Version = '1.1'

# Páginas que pueden pedir un escaneo (expresión regular sobre el encabezado Origin).
$OrigenesPermitidos = '^https?://(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|([a-z0-9-]+\.)*ingeniocasiano\.com)(:\d+)?$'

$Base = $env:LOCALAPPDATA
if (-not $Base) { $Base = [IO.Path]::GetTempPath() }
$Carpeta = Join-Path $Base 'AgenteEscaner'
New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null
$Registro = Join-Path $Carpeta 'agente.log'

function Anotar([string]$texto) {
    $linea = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $texto
    try { Add-Content -Path $Registro -Value $linea -Encoding UTF8 } catch { }
    Write-Host $linea
}

# --------------------------------------------------------------------- WIA
$FormatoJpg = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'

function Get-Escaneres {
    if ($env:ESCANER_SIMULADO) {
        return @(@{ id = 'simulado'; nombre = 'Escáner simulado' })
    }
    $dm = New-Object -ComObject WIA.DeviceManager
    $lista = @()
    foreach ($d in $dm.DeviceInfos) {
        if ($d.Type -eq 1) {                       # 1 = escáner
            $nombre = $d.Properties.Item('Name').Value
            $lista += @{ id = $d.DeviceID; nombre = $nombre }
        }
    }
    return $lista
}

function Set-Propiedad($item, [int]$id, $valor) {
    try {
        $item.Properties.Item("$id").Value = $valor
        return
    } catch { }
    foreach ($p in $item.Properties) {
        if ($p.PropertyID -eq $id) {
            try { $p.Value = $valor } catch { Anotar "  (el escáner no aceptó la propiedad $id = $valor)" }
            return
        }
    }
}

function Get-Maximo($item, [int]$id) {
    foreach ($p in $item.Properties) {
        if ($p.PropertyID -eq $id) {
            try { return $p.SubTypeMax } catch { return $null }
        }
    }
    return $null
}

function Invoke-Escaneo([string]$dispositivo, [int]$dpi, [bool]$color) {
    if ($env:ESCANER_SIMULADO) {
        Start-Sleep -Milliseconds 300
        $script:TipoUltimo = 'image/jpeg'
        return ,([IO.File]::ReadAllBytes($env:ESCANER_SIMULADO))
    }
    $dm = New-Object -ComObject WIA.DeviceManager
    $info = $null
    foreach ($d in $dm.DeviceInfos) {
        if ($d.Type -eq 1 -and (-not $dispositivo -or $d.DeviceID -eq $dispositivo)) { $info = $d; break }
    }
    if (-not $info) { throw 'No hay ningún escáner conectado (o está apagado).' }

    $dev = $info.Connect()
    $item = $dev.Items.Item(1)
    # Orden recomendado por WIA: intención, resolución y después el área.
    Set-Propiedad $item 6146 ($(if ($color) { 1 } else { 2 }))   # 1 color, 2 gris
    Set-Propiedad $item 6147 $dpi                                # resolución horizontal
    Set-Propiedad $item 6148 $dpi                                # resolución vertical
    Set-Propiedad $item 6149 0                                   # desde la esquina
    Set-Propiedad $item 6150 0
    $ancho = Get-Maximo $item 6151
    $alto = Get-Maximo $item 6152
    if ($ancho) { Set-Propiedad $item 6151 $ancho }              # todo el vidrio
    if ($alto) { Set-Propiedad $item 6152 $alto }

    # Tres formas de pedir la imagen: cada controlador acepta alguna.
    $img = $null
    $intentos = @(
        @{ nombre = 'Transfer(JPG)';      accion = { $item.Transfer($FormatoJpg) } },
        @{ nombre = 'Transfer()';         accion = { $item.Transfer() } },
        @{ nombre = 'ShowTransfer(JPG)';  accion = { (New-Object -ComObject WIA.CommonDialog).ShowTransfer($item, $FormatoJpg, $false) } }
    )
    $errores = @()
    foreach ($i in $intentos) {
        try {
            $img = & $i.accion
            if ($img) { Anotar "  imagen recibida con $($i.nombre) (formato $($img.FormatID))"; break }
        } catch {
            $errores += "$($i.nombre): $($_.Exception.Message)"
            Anotar "  $($i.nombre) falló: $($_.Exception.Message)"
        }
    }
    if (-not $img) { throw ('El escáner no entregó la imagen. ' + ($errores -join ' | ')) }

    $extension = 'jpg'
    if ($img.FormatID -ne $FormatoJpg) {
        # Algunos controladores entregan BMP o PNG: se intenta pasar a JPG. Si no se
        # puede, se manda tal cual (el navegador la convierte al subirla).
        try {
            $ip = New-Object -ComObject WIA.ImageProcess
            $ip.Filters.Add($ip.FilterInfos.Item('Convert').FilterID)
            $ip.Filters.Item(1).Properties.Item('FormatID').Value = $FormatoJpg
            $ip.Filters.Item(1).Properties.Item('Quality').Value = 90
            $img = $ip.Apply($img)
        } catch {
            Anotar "  no se pudo convertir a JPG ($($_.Exception.Message)); se envía como viene"
            $extension = 'bmp'
            if ($img.FormatID -eq '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}') { $extension = 'png' }
        }
    }
    $tmp = Join-Path $Carpeta ('escaneo-{0}.{1}' -f [guid]::NewGuid(), $extension)
    try {
        $img.SaveFile($tmp)
        $script:TipoUltimo = @{ jpg = 'image/jpeg'; bmp = 'image/bmp'; png = 'image/png' }[$extension]
        # La coma evita que PowerShell desarme el arreglo de bytes al devolverlo.
        return ,([IO.File]::ReadAllBytes($tmp))
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
    }
}

# --------------------------------------------------------------------- HTTP
function ConvertTo-Json1($obj) {
    # ConvertTo-Json de PowerShell 5 escapa los acentos: se deja como está.
    return ($obj | ConvertTo-Json -Depth 5 -Compress)
}

function Send-Respuesta($stream, [int]$codigo, [string]$tipo, [byte[]]$cuerpo, [string]$origen) {
    $textos = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 403 = 'Forbidden'; 404 = 'Not Found'; 500 = 'Internal Server Error'; 503 = 'Service Unavailable' }
    $enc = "HTTP/1.1 $codigo $($textos[$codigo])`r`n"
    if ($origen) {
        $enc += "Access-Control-Allow-Origin: $origen`r`nVary: Origin`r`n"
        $enc += "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n"
        $enc += "Access-Control-Allow-Headers: Content-Type`r`n"
        $enc += "Access-Control-Allow-Private-Network: true`r`n"
        $enc += "Access-Control-Max-Age: 600`r`n"
    }
    if ($tipo) { $enc += "Content-Type: $tipo`r`n" }
    $largo = 0
    if ($cuerpo) { $largo = $cuerpo.Length }
    $enc += "Content-Length: $largo`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $b = [Text.Encoding]::ASCII.GetBytes($enc)
    $stream.Write($b, 0, $b.Length)
    if ($largo -gt 0) { $stream.Write($cuerpo, 0, $largo) }
    $stream.Flush()
}

function Send-Json($stream, [int]$codigo, $obj, [string]$origen) {
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json1 $obj))
    Send-Respuesta $stream $codigo 'application/json; charset=utf-8' $bytes $origen
}

function Read-Pedido($stream) {
    $lector = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $primera = $lector.ReadLine()
    if (-not $primera) { return $null }
    $enc = @{}
    while ($true) {
        $l = $lector.ReadLine()
        if ($null -eq $l -or $l -eq '') { break }
        $i = $l.IndexOf(':')
        if ($i -gt 0) { $enc[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() }
    }
    $partes = $primera.Split(' ')
    $metodo = $partes[0]
    $url = $partes[1]
    $ruta = $url
    $consulta = @{}
    $q = $url.IndexOf('?')
    if ($q -ge 0) {
        $ruta = $url.Substring(0, $q)
        foreach ($par in $url.Substring($q + 1).Split('&')) {
            $kv = $par.Split('=', 2)
            if ($kv[0]) {
                $v = ''
                if ($kv.Length -gt 1) { $v = [Uri]::UnescapeDataString($kv[1]) }
                $consulta[$kv[0]] = $v
            }
        }
    }
    return @{ metodo = $metodo; ruta = $ruta; consulta = $consulta; encabezados = $enc }
}

function Invoke-Pedido($cliente) {
    $cliente.ReceiveTimeout = 10000
    $stream = $cliente.GetStream()
    try {
        $p = Read-Pedido $stream
        if (-not $p) { return }
        $origen = $p.encabezados['origin']
        $permitido = $null
        if ($origen -and $origen -match $OrigenesPermitidos) { $permitido = $origen }
        if ($origen -and -not $permitido) {
            Anotar "Rechazado: $($p.metodo) $($p.ruta) desde $origen"
            Send-Json $stream 403 @{ error = "Esta página no puede usar el escáner: $origen" } $null
            return
        }

        if ($p.metodo -eq 'OPTIONS') { Send-Respuesta $stream 204 $null $null $permitido; return }

        if ($p.metodo -eq 'GET' -and $p.ruta -eq '/estado') {
            try {
                $esc = @(Get-Escaneres)
                Send-Json $stream 200 @{ ok = $true; version = $Version; escaneres = $esc } $permitido
            } catch {
                Send-Json $stream 200 @{ ok = $false; version = $Version; escaneres = @(); error = "$($_.Exception.Message)" } $permitido
            }
            return
        }

        if ($p.metodo -eq 'POST' -and $p.ruta -eq '/escanear') {
            $dpi = $DpiPorDefecto
            if ($p.consulta['dpi']) { $dpi = [Math]::Max(100, [Math]::Min(600, [int]$p.consulta['dpi'])) }
            $color = $p.consulta['color'] -ne '0'
            Anotar "Escaneando ($dpi dpi, color: $color) para $origen"
            try {
                $bytes = Invoke-Escaneo $p.consulta['dispositivo'] $dpi $color
                Anotar "  listo: $([Math]::Round($bytes.Length / 1024)) KB"
                Send-Respuesta $stream 200 $script:TipoUltimo $bytes $permitido
            } catch {
                $msg = "$($_.Exception.Message)"
                Anotar "  error: $msg (línea $($_.InvocationInfo.ScriptLineNumber))"
                Anotar "  $($_.ScriptStackTrace -replace "`r?`n", ' <- ')"
                Send-Json $stream 503 @{ error = "No se pudo escanear: $msg" } $permitido
            }
            return
        }

        Send-Json $stream 404 @{ error = 'Ruta desconocida' } $permitido
    } catch {
        Anotar "Error atendiendo un pedido: $($_.Exception.Message)"
    } finally {
        try { $stream.Dispose() } catch { }
        $cliente.Close()
    }
}

# --------------------------------------------------------------------- inicio
# WIA solo funciona en un hilo STA («La conversión especificada no es válida» en
# MTA, como en PowerShell 7): si no es así, se vuelve a lanzar con -STA.
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA' -and -not $env:ESCANER_SIMULADO) {
    Anotar 'Relanzando en modo STA con Windows PowerShell'
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    Start-Process -WindowStyle Hidden -FilePath $ps -ArgumentList @('-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Puerto', $Puerto)
    exit 0
}
$script:TipoUltimo = 'image/jpeg'
$escucha = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Puerto)
try {
    $escucha.Start()
} catch {
    Anotar "No se pudo abrir el puerto $Puerto (¿el agente ya está corriendo?): $($_.Exception.Message)"
    exit 1
}
Anotar "Agente del escáner $Version escuchando en http://127.0.0.1:$Puerto"
try {
    while ($true) {
        $cliente = $escucha.AcceptTcpClient()
        Invoke-Pedido $cliente
    }
} finally {
    $escucha.Stop()
}
