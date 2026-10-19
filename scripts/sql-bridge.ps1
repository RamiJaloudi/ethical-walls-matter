$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $env:AM100_SQL_SERVER
$builder['Initial Catalog'] = 'AM100IntegrationDemo'
$builder['Integrated Security'] = $true
$builder['Connect Timeout'] = 10
$builder['Application Name'] = 'AM100 Integration Demo'
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
$transaction = $null
function Command($sql, $values) {
  $cmd = $connection.CreateCommand()
  $cmd.CommandText = $sql
  $cmd.CommandTimeout = 30
  if ($script:transaction) { $cmd.Transaction = $script:transaction }
  foreach ($property in $values.PSObject.Properties) {
    $parameter = $cmd.Parameters.Add('@' + $property.Name, [System.Data.SqlDbType]::NVarChar, -1)
    $parameter.Value = if ($null -eq $property.Value) { [DBNull]::Value } else { [string]$property.Value }
  }
  return $cmd
}
try {
  $connection.Open()
  $transaction = $connection.BeginTransaction([System.Data.IsolationLevel]::Serializable)
  if ($inputData.operation -eq 'api-audit') {
    $auditCommand = Command 'EXEC api.AppendAudit @id,@at,@path,@status,@correlationId,@requestJson,@responseJson' $inputData.entry
    [void]$auditCommand.ExecuteNonQuery()
    $transaction.Commit(); '{"saved":true}'; exit 0
  }
  if ($inputData.operation -eq 'api-read') {
    $data = [ordered]@{}
    foreach ($query in $inputData.queries) {
      $cmd = Command $query.sql $query.params
      $reader = $cmd.ExecuteReader()
      $rows = New-Object System.Collections.Generic.List[object]
      while ($reader.Read()) {
        $row = [ordered]@{}
        for ($i=0; $i -lt $reader.FieldCount; $i++) { $row[$reader.GetName($i)] = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) } }
        $rows.Add([pscustomobject]$row)
      }
      $reader.Close(); $cmd.Dispose(); $data[$query.name] = @($rows.ToArray())
    }
    $transaction.Commit(); @{data=$data} | ConvertTo-Json -Depth 100 -Compress; exit 0
  }
  $versionCommand = Command 'SELECT VersionNumber FROM dbo.StateVersions WITH (UPDLOCK,HOLDLOCK) WHERE RoleName=@role' ([pscustomobject]@{role=$inputData.role})
  $storedVersion = $versionCommand.ExecuteScalar()
  $version = if ($null -eq $storedVersion) { 0 } else { [int]$storedVersion }
  if ($inputData.operation -eq 'read') {
    $output = [ordered]@{ version=$version; data=[ordered]@{} }
    foreach ($query in $inputData.queries) {
      $cmd = Command $query.sql $query.params
      $reader = $cmd.ExecuteReader()
      $rows = New-Object System.Collections.Generic.List[object]
      while ($reader.Read()) {
        $row = [ordered]@{}
        for ($i=0; $i -lt $reader.FieldCount; $i++) { $row[$reader.GetName($i)] = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) } }
        $rows.Add([pscustomobject]$row)
      }
      $reader.Close(); $cmd.Dispose()
      $output.data[$query.name] = @($rows.ToArray())
    }
    $transaction.Commit()
    $output | ConvertTo-Json -Depth 100 -Compress
  } elseif ($inputData.operation -eq 'write') {
    if ($version -ne [int]$inputData.expectedVersion) {
      $transaction.Rollback(); '{"conflict":true}'; exit 0
    }
    foreach ($statement in $inputData.statements) {
      $cmd = Command $statement.sql $statement.params
      [void]$cmd.ExecuteNonQuery(); $cmd.Dispose()
    }
    $cmd = Command 'UPDATE dbo.StateVersions SET VersionNumber=@version WHERE RoleName=@role; IF @@ROWCOUNT=0 INSERT dbo.StateVersions(RoleName,VersionNumber) VALUES(@role,@version);' ([pscustomobject]@{role=$inputData.role;version=($version+1)})
    [void]$cmd.ExecuteNonQuery()
    $transaction.Commit(); '{"saved":true}'
  } else { throw 'Unknown database operation.' }
} catch {
  if ($transaction) { try { $transaction.Rollback() } catch {} }
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally { $connection.Dispose() }
