-- Run as a SQL administrator. Everything, including the test user, is rolled back.
USE AM100IntegrationDemo;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
CREATE USER [ApiPermissionTest] WITHOUT LOGIN;
ALTER ROLE Am100ApiReader ADD MEMBER [ApiPermissionTest];
EXECUTE AS USER = 'ApiPermissionTest';
SELECT TOP (1) * FROM api.ClientMatters;
SELECT TOP (1) * FROM api.Users;
IF HAS_PERMS_BY_NAME('dbo.Clients','OBJECT','SELECT')=1
    THROW 50010, 'Unexpected direct base table SELECT permission', 1;
IF HAS_PERMS_BY_NAME('dbo.Clients','OBJECT','UPDATE')=1
    THROW 50011, 'Unexpected base table UPDATE permission', 1;
IF HAS_PERMS_BY_NAME('api.AppendAudit','OBJECT','EXECUTE')<>1
    THROW 50012, 'Missing audit procedure permission', 1;
EXEC api.AppendAudit N'permission-test',N'2026-10-19T00:00:00Z',N'/permission-test',200,N'permission-test',N'{}',N'{}';
REVERT;
ROLLBACK;
PRINT 'PASS: view read and audit append allowed; direct base table read and update absent; test rolled back.';
GO
