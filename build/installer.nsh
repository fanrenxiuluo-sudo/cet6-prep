!include LogicLib.nsh

!macro cet6PrepDefaultInstallDir
  ${If} "$installMode" == "all"
    StrCpy $0 "$PROGRAMFILES"
    !ifdef APP_64
      ${If} ${RunningX64}
        StrCpy $0 "$PROGRAMFILES64"
      ${EndIf}
    !endif
    !ifdef MENU_FILENAME
      StrCpy $0 "$0\${MENU_FILENAME}"
    !endif
    StrCpy $INSTDIR "$0\${APP_FILENAME}"
  ${Else}
    StrCpy $INSTDIR "$LocalAppData\Programs\${APP_FILENAME}"
  ${EndIf}
!macroend

!macro cet6PrepRedirectDesktopInstallDir
  ${If} "$INSTDIR" == "$DESKTOP"
  ${OrIf} "$INSTDIR" == "$DESKTOP\${APP_FILENAME}"
    !insertmacro cet6PrepDefaultInstallDir
  ${EndIf}
!macroend

!macro customInit
  !insertmacro cet6PrepRedirectDesktopInstallDir
!macroend

!macro customPageAfterChangeDir
  Page custom cet6PrepDirectoryGuard
  Function cet6PrepDirectoryGuard
    !insertmacro cet6PrepRedirectDesktopInstallDir
    Abort
  FunctionEnd
!macroend
