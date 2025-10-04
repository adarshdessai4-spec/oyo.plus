# OYO.plus site (Express static server)

## Run locally
```bash
cd oyo
# If dependencies are missing:
npm i
# Start
PORT=8080 HOST=0.0.0.0 node server.js
# Open http://localhost:8080 (health: http://localhost:8080/healthz)
```

## Common issues
- **Port already in use**: change port `PORT=5173 node server.js` or free it:
  ```bash
  sudo ss -ltnp | grep :8080
  sudo kill -9 <PID>
  ```
- **Opened as file (`file:///index.html`)**: run the server instead; forms need the API.
- **Behind Nginx**: use the sample config below.

## Docker
```bash
cd oyo
docker build -t oyo-site .
docker run -p 8080:8080 --env PORT=8080 --env HOST=0.0.0.0 oyo-site
```

## Nginx reverse proxy (sample)
```
server {
  server_name yourdomain.com;
  listen 80;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Environment (.env)
```
PORT=8080
HOST=0.0.0.0
# Optional for payment test stubs
PLATFORM_FEE_PCT=10
AXIS_ACCOUNT_MAIN=XXXX
AXIS_ACCOUNT_VENDOR=YYYY
```
