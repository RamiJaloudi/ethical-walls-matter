-- MANUAL TEMPLATE. Replace YOURPC with your Windows computer name.
-- First create the Windows account svc_AM100Api using the Learning Manual.
-- This is the AM100 API identity, not the vendor's OAuth service account.
USE master;
GO
CREATE LOGIN [YOURPC\svc_AM100Api] FROM WINDOWS;
GO
USE AM100IntegrationDemo;
GO
CREATE USER [YOURPC\svc_AM100Api] FOR LOGIN [YOURPC\svc_AM100Api];
GO
ALTER ROLE Am100ApiReader ADD MEMBER [YOURPC\svc_AM100Api];
GO
-- No sysadmin, db_owner, db_datareader or db_datawriter memberships are needed.
