IF DB_ID(N'AM100IntegrationDemo') IS NULL CREATE DATABASE AM100IntegrationDemo;
GO
USE AM100IntegrationDemo;
GO
IF OBJECT_ID(N'dbo.StateVersions',N'U') IS NULL
BEGIN
CREATE TABLE dbo.StateVersions(RoleName nvarchar(10) NOT NULL PRIMARY KEY, VersionNumber int NOT NULL);
CREATE TABLE dbo.FirmSettings(Id int NOT NULL PRIMARY KEY CHECK(Id=1), PolicyMode nvarchar(5) NOT NULL CHECK(PolicyMode IN ('deny','allow')), MatterApiAvailable bit NOT NULL, WallApiAvailable bit NOT NULL, PolicyRevision int NOT NULL);
CREATE TABLE dbo.Clients(ClientId nvarchar(40) NOT NULL PRIMARY KEY, ClientName nvarchar(160) NOT NULL, IsActive bit NOT NULL);
CREATE TABLE dbo.Matters(MatterKey int NOT NULL PRIMARY KEY, MatterNumber nvarchar(40) NOT NULL, MatterName nvarchar(160) NOT NULL, IsActive bit NOT NULL);
CREATE TABLE dbo.ClientMatters(ClientId nvarchar(40) NOT NULL REFERENCES dbo.Clients(ClientId), MatterKey int NOT NULL REFERENCES dbo.Matters(MatterKey), PRIMARY KEY(ClientId,MatterKey), UNIQUE(MatterKey));
CREATE TABLE dbo.FirmUsers(Email nvarchar(254) NOT NULL PRIMARY KEY, EmployeeNumber nvarchar(40) NOT NULL UNIQUE, FullName nvarchar(160) NOT NULL, JobRole nvarchar(160) NOT NULL, IsActive bit NOT NULL);
CREATE TABLE dbo.EthicalWallRules(RuleId nvarchar(64) NOT NULL PRIMARY KEY, ClientId nvarchar(40) NOT NULL, MatterKey int NOT NULL, Email nvarchar(254) NOT NULL REFERENCES dbo.FirmUsers(Email), Decision nvarchar(5) NOT NULL CHECK(Decision IN ('allow','deny')), Reason nvarchar(300) NOT NULL, FOREIGN KEY(ClientId,MatterKey) REFERENCES dbo.ClientMatters(ClientId,MatterKey), UNIQUE(ClientId,MatterKey,Email));
CREATE TABLE dbo.VendorUsers(Email nvarchar(254) NOT NULL PRIMARY KEY, FullName nvarchar(160) NOT NULL, JobRole nvarchar(160) NOT NULL, IsActive bit NOT NULL);
CREATE TABLE dbo.Workspaces(WorkspaceId nvarchar(64) NOT NULL PRIMARY KEY, WorkspaceName nvarchar(160) NOT NULL, ClientId nvarchar(40) NOT NULL, MatterNumber nvarchar(40) NOT NULL, ClientName nvarchar(160) NULL, MatterName nvarchar(160) NULL, PolicyMode nvarchar(5) NOT NULL, PolicyRevision int NOT NULL, WorkspaceStatus nvarchar(20) NOT NULL, CreatedAt nvarchar(40) NOT NULL, CheckedAt nvarchar(40) NOT NULL, LastError nvarchar(1000) NULL, SortOrder int NOT NULL);
CREATE TABLE dbo.WorkspaceMembers(WorkspaceId nvarchar(64) NOT NULL REFERENCES dbo.Workspaces(WorkspaceId), Email nvarchar(254) NOT NULL, IsRequested bit NOT NULL, IsAdmitted bit NOT NULL, ExclusionReason nvarchar(1000) NULL, SortOrder int NOT NULL, PRIMARY KEY(WorkspaceId,Email));
CREATE TABLE dbo.AuditLog(EventId nvarchar(64) NOT NULL PRIMARY KEY, AppRole nvarchar(10) NOT NULL, EventTime nvarchar(40) NOT NULL, Endpoint nvarchar(200) NOT NULL, HttpStatus int NOT NULL, CorrelationId nvarchar(100) NOT NULL, RequestJson nvarchar(max) NOT NULL CHECK(ISJSON(RequestJson)=1), ResponseJson nvarchar(max) NOT NULL CHECK(ISJSON(ResponseJson)=1), DurationMs int NULL, SortOrder int NOT NULL);
END;
GO
CREATE OR ALTER VIEW dbo.vwUsers AS SELECT Email AS email,EmployeeNumber AS employeeNumber,FullName AS name,JobRole AS role,IsActive AS active FROM dbo.FirmUsers;
GO
CREATE OR ALTER VIEW dbo.vwClients AS SELECT ClientId AS id,ClientName AS name,IsActive AS active FROM dbo.Clients;
GO
CREATE OR ALTER VIEW dbo.vwMatters AS SELECT MatterKey AS matterKey,MatterNumber AS id,MatterName AS name,IsActive AS active FROM dbo.Matters;
GO
CREATE OR ALTER VIEW dbo.vwClientMatters AS SELECT c.ClientId AS clientId,c.ClientName AS clientName,c.IsActive AS clientActive,m.MatterKey AS matterKey,m.MatterNumber AS id,m.MatterName AS name,m.IsActive AS active FROM dbo.ClientMatters cm JOIN dbo.Clients c ON c.ClientId=cm.ClientId JOIN dbo.Matters m ON m.MatterKey=cm.MatterKey;
GO
CREATE OR ALTER VIEW dbo.vwEthicalWalls AS SELECT r.RuleId AS id,r.ClientId AS clientId,m.MatterNumber AS matterId,r.Email AS email,r.Decision AS effect,r.Reason AS reason,u.EmployeeNumber AS employeeNumber FROM dbo.EthicalWallRules r JOIN dbo.Matters m ON m.MatterKey=r.MatterKey JOIN dbo.FirmUsers u ON u.Email=r.Email;
GO
CREATE OR ALTER VIEW dbo.vwSettings AS SELECT PolicyMode AS mode,MatterApiAvailable AS matterApi,WallApiAvailable AS wallApi,PolicyRevision AS revision FROM dbo.FirmSettings;
GO
CREATE OR ALTER VIEW dbo.vwVendorUsers AS SELECT Email AS email,FullName AS name,JobRole AS role,IsActive AS active FROM dbo.VendorUsers;
GO
CREATE OR ALTER VIEW dbo.vwWorkspaces AS SELECT WorkspaceId AS id,WorkspaceName AS name,ClientId AS clientId,MatterNumber AS matterId,ClientName AS clientName,MatterName AS matterName,PolicyMode AS mode,PolicyRevision AS policyRevision,WorkspaceStatus AS status,CreatedAt AS createdAt,CheckedAt AS checkedAt,LastError AS lastError,SortOrder AS sortOrder FROM dbo.Workspaces;
GO
CREATE OR ALTER VIEW dbo.vwWorkspaceMembers AS SELECT WorkspaceId AS workspaceId,Email AS email,IsRequested AS requested,IsAdmitted AS admitted,ExclusionReason AS reason,SortOrder AS sortOrder FROM dbo.WorkspaceMembers;
GO
CREATE OR ALTER VIEW dbo.vwAuditLog AS SELECT EventId AS id,AppRole AS appRole,EventTime AS at,Endpoint AS path,HttpStatus AS status,CorrelationId AS correlationId,RequestJson AS requestJson,ResponseJson AS responseJson,DurationMs AS durationMs,SortOrder AS sortOrder FROM dbo.AuditLog;
GO
IF COL_LENGTH('dbo.FirmSettings','EnforceMatterFlags') IS NULL ALTER TABLE dbo.FirmSettings ADD EnforceMatterFlags bit NOT NULL CONSTRAINT DF_FirmSettings_EnforceFlags DEFAULT 1 WITH VALUES;
IF COL_LENGTH('dbo.Workspaces','EnvironmentJson') IS NULL ALTER TABLE dbo.Workspaces ADD EnvironmentJson nvarchar(max) NOT NULL CONSTRAINT DF_Workspaces_Environment DEFAULT '{}' WITH VALUES;
IF COL_LENGTH('dbo.Workspaces','ValidationFlagsJson') IS NULL ALTER TABLE dbo.Workspaces ADD ValidationFlagsJson nvarchar(max) NOT NULL CONSTRAINT DF_Workspaces_Flags DEFAULT '[]' WITH VALUES;
IF OBJECT_ID(N'dbo.FlagPolicies',N'U') IS NULL CREATE TABLE dbo.FlagPolicies(FlagCode nvarchar(40) NOT NULL PRIMARY KEY,FlagLabel nvarchar(80) NOT NULL,Description nvarchar(300) NOT NULL,BlockCloud bit NOT NULL,BlockAI bit NOT NULL,BlockExternal bit NOT NULL,AllowedRegionsJson nvarchar(100) NOT NULL CHECK(ISJSON(AllowedRegionsJson)=1));
IF OBJECT_ID(N'dbo.MatterFlags',N'U') IS NULL CREATE TABLE dbo.MatterFlags(ClientId nvarchar(40) NOT NULL,MatterKey int NOT NULL,FlagCode nvarchar(40) NOT NULL REFERENCES dbo.FlagPolicies(FlagCode),PRIMARY KEY(ClientId,MatterKey,FlagCode),FOREIGN KEY(ClientId,MatterKey) REFERENCES dbo.ClientMatters(ClientId,MatterKey));
GO
CREATE OR ALTER VIEW dbo.vwSettings AS SELECT PolicyMode AS mode,MatterApiAvailable AS matterApi,WallApiAvailable AS wallApi,PolicyRevision AS revision,EnforceMatterFlags AS enforceMatterFlags FROM dbo.FirmSettings;
GO
CREATE OR ALTER VIEW dbo.vwFlagPolicies AS SELECT FlagCode AS code,FlagLabel AS label,Description AS description,BlockCloud AS blockCloud,BlockAI AS blockAI,BlockExternal AS blockExternal,AllowedRegionsJson AS allowedRegionsJson FROM dbo.FlagPolicies;
GO
CREATE OR ALTER VIEW dbo.vwMatterFlags AS SELECT f.ClientId AS clientId,m.MatterNumber AS matterId,f.FlagCode AS flag FROM dbo.MatterFlags f JOIN dbo.Matters m ON m.MatterKey=f.MatterKey;
GO
CREATE OR ALTER VIEW dbo.vwWorkspaces AS SELECT WorkspaceId AS id,WorkspaceName AS name,ClientId AS clientId,MatterNumber AS matterId,ClientName AS clientName,MatterName AS matterName,PolicyMode AS mode,PolicyRevision AS policyRevision,WorkspaceStatus AS status,CreatedAt AS createdAt,CheckedAt AS checkedAt,LastError AS lastError,SortOrder AS sortOrder,EnvironmentJson AS environmentJson,ValidationFlagsJson AS flagsJson FROM dbo.Workspaces;
GO
