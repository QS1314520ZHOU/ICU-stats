# ICU Stats OEL 8.2 Binary Package

## Build on a machine with Docker

Windows PowerShell:

```powershell
.\scripts\build-oel8-binary.ps1
```

Linux/macOS:

```bash
chmod +x build-oel8-binary.sh
./build-oel8-binary.sh
```

The host can be OEL9. The build runs inside the `oraclelinux:8.2` Docker image, so the generated binary targets OEL8-compatible Linux x64.

Alternative script path:

```bash
chmod +x scripts/build-oel8-binary.sh
./scripts/build-oel8-binary.sh
```

Output directory:

```text
release/oel8-binary/
  icu-stats
  .env.example
  run.sh
```

## Configure database

Create `.env` next to `icu-stats`:

```env
MONGO_URL=mongodb://10.0.0.12:27017
MONGO_DB=SmartCare
PORT=3000
```

Example with authentication:

```env
MONGO_URL=mongodb://smartcare_user:change_me@10.0.0.12:27017/SmartCare?authSource=admin
MONGO_DB=SmartCare
PORT=3000
```

## Run on OEL 8.2

```bash
cd release/oel8-binary
cp .env.example .env
vi .env
chmod +x icu-stats run.sh
./run.sh
```

Open:

```text
http://server-ip:3000/?deptCode=3439&hisPid=1693737
```
