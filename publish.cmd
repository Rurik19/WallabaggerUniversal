
Set t=%*
If Not Defined t GOTO END

If %1==chrome  GOTO WORK
If %1==firefox GOTO WORK
If %1==edge    GOTO WORK
GOTO END

:WORK
set target=%1
echo build for %target%
rd /S /Q publish\%target%
md publish\%target%
If %1==edge    GOTO EDGE
GOTO END

:EDGE
copy manifest\AppxManifest.xml publish\%target%
md publish\%target%\Extension
md publish\%target%\Assets
for %%a in (44, 50, 150) do copy images\wallabagger-%%a.png publish\%target%\Assets
xcopy /E /Y build\%target%\*.* publish\%target%\Extension
"C:\Program Files (x86)\Windows Kits\10\App Certification Kit\makeappx.exe" pack /h SHA256 /d publish\%target% /p publish\wallabagger.appx
GOTO END

:END
echo end publishing
