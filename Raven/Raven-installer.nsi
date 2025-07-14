!define APP_NAME "Raven"
; 注意：NSIS安装脚本的版本号现在由build.py动态生成
!define APP_PUBLISHER "GalaxySpace"
!define APP_DESCRIPTION "卫星通信载荷测试人员升级包制作工具"

Name "${APP_NAME}"
OutFile "dist/${APP_NAME}-${APP_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES\${APP_NAME}"
RequestExecutionLevel admin

Section "Install"
    SetOutPath "$INSTDIR"
    File /r "dist\Raven\*"
    
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "Publisher" "${APP_PUBLISHER}"
    
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" \
                   "$INSTDIR\Raven.exe"
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" \
                   "$INSTDIR\Raven.exe"
    
    WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\*"
    RMDir /r "$INSTDIR"
    Delete "$SMPROGRAMS\${APP_NAME}\*"
    RMDir "$SMPROGRAMS\${APP_NAME}"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
SectionEnd
