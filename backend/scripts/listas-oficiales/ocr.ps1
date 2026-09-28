param([string]$Carpeta)
# OCR de Windows (es-ES) sobre cada PNG de la carpeta: escribe <pagina>.tsv con x, y, ancho, alto y texto de cada palabra.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Esperar($operacion, $tipo) {
  $tarea = $asTask.MakeGenericMethod($tipo).Invoke($null, @($operacion))
  $tarea.Wait(-1) | Out-Null
  $tarea.Result
}
$motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("es-ES"))
Get-ChildItem -Path $Carpeta -Filter *.png | Sort-Object Name | ForEach-Object {
  $salida = [IO.Path]::ChangeExtension($_.FullName, ".tsv")
  if (Test-Path $salida) { return }
  $archivo = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)) ([Windows.Storage.StorageFile])
  $flujo = Esperar ($archivo.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decodificador = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($flujo)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $mapa = Esperar ($decodificador.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $resultado = Esperar ($motor.RecognizeAsync($mapa)) ([Windows.Media.Ocr.OcrResult])
  $lineas = foreach ($linea in $resultado.Lines) {
    foreach ($p in $linea.Words) {
      "{0}`t{1}`t{2}`t{3}`t{4}" -f [int]$p.BoundingRect.X, [int]$p.BoundingRect.Y, [int]$p.BoundingRect.Width, [int]$p.BoundingRect.Height, $p.Text
    }
  }
  [IO.File]::WriteAllLines($salida, [string[]]$lineas, [Text.UTF8Encoding]::new($false))
  $flujo.Dispose()
  Write-Output ("{0}: {1} palabras" -f $_.Name, @($lineas).Count)
}
