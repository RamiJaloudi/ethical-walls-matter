-- Run schema.sql first. This script creates no identities and changes no business records.
USE [AM100IntegrationDemo];
GO
IF SCHEMA_ID(N'api') IS NULL EXEC(N'CREATE SCHEMA api AUTHORIZATION dbo;');
GO
CREATE OR ALTER VIEW api.Clients AS
SELECT ClientId AS id, ClientName AS name, IsActive AS active FROM dbo.Clients;
GO
CREATE OR ALTER VIEW api.ClientMatters AS
SELECT cm.ClientId AS clientId, m.MatterNumber AS id, m.MatterName AS name,
       m.IsActive AS active, m.MatterKey AS matterKey,
       c.IsActive AS clientActive,
       CONVERT(bit, CASE WHEN c.IsActive=1 AND m.IsActive=1 THEN 1 ELSE 0 END) AS isValid
FROM dbo.ClientMatters cm
JOIN dbo.Clients c ON c.ClientId=cm.ClientId
JOIN dbo.Matters m ON m.MatterKey=cm.MatterKey;
GO
-- Employee numbers remain private to the administrative data model.
CREATE OR ALTER VIEW api.Users AS
SELECT Email AS email, IsActive AS active FROM dbo.FirmUsers;
GO
CREATE OR ALTER VIEW api.EthicalWalls AS
SELECT r.RuleId AS id, r.ClientId AS clientId, m.MatterNumber AS matterId,
       r.Email AS email, r.Decision AS effect, r.Reason AS reason
FROM dbo.EthicalWallRules r JOIN dbo.Matters m ON m.MatterKey=r.MatterKey;
GO
CREATE OR ALTER VIEW api.Settings AS
SELECT PolicyMode AS mode, MatterApiAvailable AS matterApi, WallApiAvailable AS wallApi,
       PolicyRevision AS revision, EnforceMatterFlags AS enforceMatterFlags FROM dbo.FirmSettings;
GO
CREATE OR ALTER VIEW api.FlagPolicies AS
SELECT FlagCode AS code, FlagLabel AS label, Description AS description,
       BlockCloud AS blockCloud, BlockAI AS blockAI, BlockExternal AS blockExternal,
       AllowedRegionsJson AS allowedRegionsJson FROM dbo.FlagPolicies;
GO
CREATE OR ALTER VIEW api.MatterFlags AS
SELECT f.ClientId AS clientId, m.MatterNumber AS matterId, f.FlagCode AS flag
FROM dbo.MatterFlags f JOIN dbo.Matters m ON m.MatterKey=f.MatterKey;
GO
-- The API can append one event, but cannot delete or rewrite audit history.
CREATE OR ALTER PROCEDURE api.AppendAudit
  @id nvarchar(64), @at nvarchar(40), @path nvarchar(200), @status int,
  @correlationId nvarchar(100), @requestJson nvarchar(max), @responseJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@requestJson)<>1 OR ISJSON(@responseJson)<>1 THROW 50001, 'Audit JSON is invalid.', 1;
  -- Admin writes also lock this row. Preserve a consistent serialization order.
  DECLARE @version int;
  SELECT @version=VersionNumber FROM dbo.StateVersions WITH (UPDLOCK,HOLDLOCK) WHERE RoleName=N'firm';
  INSERT dbo.AuditLog(EventId,AppRole,EventTime,Endpoint,HttpStatus,CorrelationId,RequestJson,ResponseJson,DurationMs,SortOrder)
  VALUES(@id,N'firm',@at,@path,@status,@correlationId,@requestJson,@responseJson,NULL,
         ISNULL((SELECT MIN(SortOrder)-1 FROM dbo.AuditLog WHERE AppRole=N'firm'),0));
  UPDATE dbo.StateVersions SET VersionNumber=VersionNumber+1 WHERE RoleName=N'firm';
END;
GO
IF DATABASE_PRINCIPAL_ID(N'Am100ApiReader') IS NULL CREATE ROLE Am100ApiReader AUTHORIZATION dbo;
GO
GRANT SELECT ON OBJECT::api.Clients TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.ClientMatters TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.Users TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.EthicalWalls TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.Settings TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.FlagPolicies TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.MatterFlags TO Am100ApiReader;
GRANT EXECUTE ON OBJECT::api.AppendAudit TO Am100ApiReader;
GO
