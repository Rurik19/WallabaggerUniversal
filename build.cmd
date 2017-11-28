Set t=%*
If Not Defined t GOTO END

If %1==chrome  GOTO WORK
If %1==firefox GOTO WORK
If %1==edge    GOTO WORK
GOTO END

:WORK
set target=%1
echo build for %target%
rd /S /Q build\%target%
md build\%target%
copy manifest\manifest.%target%.json build\%target%\manifest.json
xcopy /E /Y source build\%target%
md build\%target%\images
findstr /C:"images" manifest\manifest.%target%.json >imglist
for /f delims^=^"^/^ tokens^=5^  %%i in (imglist) do copy images\%%i build\%target%\images
del /Q imglist
copy /Y images\*.svg build\%target%\images
::echo %%i
::

:END
echo this is the end