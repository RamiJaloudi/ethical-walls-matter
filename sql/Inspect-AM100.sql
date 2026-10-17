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
