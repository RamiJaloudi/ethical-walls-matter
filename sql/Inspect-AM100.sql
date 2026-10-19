USE AM100IntegrationDemo;
GO
-- Expand AM100IntegrationDemo > Tables and Views in Object Explorer.
-- These views are the data sources used by the applications and firm APIs.
SELECT * FROM dbo.vwClients;
SELECT * FROM dbo.vwMatters;
SELECT * FROM dbo.vwClientMatters;
SELECT * FROM dbo.vwUsers;
SELECT * FROM dbo.vwEthicalWalls;
SELECT * FROM dbo.vwSettings;
SELECT * FROM dbo.vwFlagPolicies;
SELECT * FROM dbo.vwMatterFlags;
SELECT * FROM dbo.vwVendorUsers;
SELECT * FROM dbo.vwWorkspaces;
SELECT * FROM dbo.vwWorkspaceMembers;
SELECT TOP (50) * FROM dbo.vwAuditLog ORDER BY at DESC;
GO
-- Dedicated OAuth API views (installed by api-views.sql).
SELECT * FROM api.ClientMatters;
SELECT * FROM api.Users; -- Email and active status; no employee number.
SELECT * FROM api.EthicalWalls;
SELECT * FROM api.MatterFlags;
SELECT * FROM api.FlagPolicies;
SELECT * FROM api.Settings;
