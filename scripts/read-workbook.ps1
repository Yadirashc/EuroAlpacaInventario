param([string]$InputFile='data/inventario.xlsx',[string]$OutputFile='data/workbook.json')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$euroZip=[System.IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) $InputFile))
function Read-ZipXml([string]$name){$reader=New-Object System.IO.StreamReader($euroZip.GetEntry($name).Open());try{[xml]$reader.ReadToEnd()}finally{$reader.Dispose()}}
try{
 $workbook=Read-ZipXml 'xl/workbook.xml'
 $rels=Read-ZipXml 'xl/_rels/workbook.xml.rels'
 $strings=@();if($euroZip.GetEntry('xl/sharedStrings.xml')){$shared=Read-ZipXml 'xl/sharedStrings.xml';$strings=@($shared.sst.si | ForEach-Object {($_.SelectNodes('.//*[local-name()="t"]') | ForEach-Object {$_.InnerText}) -join ''})}
 $sheets=@();foreach($sheet in $workbook.workbook.sheets.sheet){
  $rid=$sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships');$target=($rels.Relationships.Relationship | Where-Object Id -eq $rid).Target
  $xml=Read-ZipXml ('xl/'+$target.TrimStart('/').Replace('xl/',''))
  $rows=@();foreach($row in $xml.worksheet.sheetData.row){
   $cells=@();foreach($cell in $row.c){$value='';if($cell.t -eq 's'){$value=$strings[[int]$cell.v]}elseif($cell.t -eq 'inlineStr'){$value=($cell.SelectNodes('.//*[local-name()="t"]') | ForEach-Object {$_.InnerText}) -join ''}else{$value=[string]$cell.v};$cells+=@{address=[string]$cell.r;value=$value;style=[string]$cell.s;formula=[string]$cell.f}}
   $rows+=@{number=[int]$row.r;cells=$cells}
  }
  $sheets+=@{name=[string]$sheet.name;rows=$rows}
 }
 @{sheets=$sheets}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $OutputFile -Encoding UTF8
 $sheets|ForEach-Object {Write-Output ($_.name+': '+$_.rows.Count+' filas físicas')}
}finally{$euroZip.Dispose()}
