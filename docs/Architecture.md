\# GAPGPT V7 Architecture



\## Project Layers



\### config



Contains immutable configuration objects.



Current modules:



\- SecurityConfig



\---



\### core



Low-level reusable primitives.



Current modules:



\- Timer



\---



\### infrastructure



Production services.



Current modules:



\- RetryEngine

\- BackupManager



Future:



\- AuthenticationManager

\- Logger

\- Scheduler



\---



\# Backup Architecture



BackupManager is responsible for the complete backup lifecycle.



\## Backup Flow



Source Directory



↓



ZIP Archive



↓



Embedded manifest.json



↓



SHA256



↓



Destination(s)



↓



Global Manifest



↓



Retention Policy



\---



\## Manifest



Global manifest location



```

backups/

&#x20;   manifest.json

```



Embedded manifest



```

backup.zip

&#x20;   manifest.json

```



\---



\## Backup Metadata



Each backup stores:



\- id

\- timestamp

\- filename

\- projectVersion

\- environment

\- sha256

\- sizeBytes



\---



\## Destination Model



Destinations are extensible.



Current types:



\- Local

\- GoogleDriveSync



Future destinations can be added without changing BackupManager API.

