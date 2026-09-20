Option Explicit

Dim shell, fso, projectRoot, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectRoot = fso.GetParentFolderName(WScript.ScriptFullName)
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & projectRoot & "\Start-Northstar.ps1" & Chr(34)
shell.Run command, 0, True
