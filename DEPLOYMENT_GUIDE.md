# OpenCV Vehicle Detection - Deployment Guide

## 🚀 Production Deployment

### Recommended Setup

```
┌─────────────────────────────────────────────┐
│         Traffic Management System           │
├─────────────────────────────────────────────┤
│  React Frontend (Vite)                     │
│  ├─ Lane Image Upload UI                   │
│  └─ Real-time Detection Display            │
│         ↓ HTTP/JSON ↓                      │
│  Python Backend (Gunicorn)                 │
│  ├─ Flask REST API                         │
│  ├─ Vehicle Detection Logic                │
│  └─ Haar Cascade Processing                │
└─────────────────────────────────────────────┘
```

## 📋 Pre-Deployment Checklist

- [ ] Python 3.8+ installed on server
- [ ] All dependencies from `requirements.txt` installed
- [ ] Database and file storage configured
- [ ] CORS policy adjusted for production domain
- [ ] SSL/TLS certificates obtained
- [ ] API key authentication implemented (if needed)
- [ ] Rate limiting configured
- [ ] Logging and monitoring setup
- [ ] Backup strategy in place

## 🏗️ Production Setup (Linux/Ubuntu)

### 1. Install System Dependencies
```bash
sudo apt-get update
sudo apt-get install python3.10 python3-pip
sudo apt-get install libopencv-dev
sudo apt-get install gunicorn nginx
```

### 2. Create Virtual Environment
```bash
python3 -m venv /opt/traffic-detector/venv
source /opt/traffic-detector/venv/bin/activate
```

### 3. Install Python Packages
```bash
cd /opt/traffic-detector
pip install -r requirements.txt
pip install gunicorn
pip install python-dotenv
```

### 4. Configure Gunicorn
Create `/opt/traffic-detector/gunicorn_config.py`:
```python
import multiprocessing

bind = "127.0.0.1:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 100
access_log = "/var/log/traffic-detector/access.log"
error_log = "/var/log/traffic-detector/error.log"
loglevel = "info"
```

### 5. Create Systemd Service
Create `/etc/systemd/system/traffic-detector.service`:
```ini
[Unit]
Description=Traffic Vehicle Detection API
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/opt/traffic-detector
Environment="PATH=/opt/traffic-detector/venv/bin"
ExecStart=/opt/traffic-detector/venv/bin/gunicorn \
  --config gunicorn_config.py \
  --access-logfile - \
  --error-logfile - \
  api_server:app

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 6. Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable traffic-detector
sudo systemctl start traffic-detector
sudo systemctl status traffic-detector
```

### 7. Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/traffic-detector`:
```nginx
upstream traffic_api {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    client_max_body_size 50M;
    
    location /api/ {
        proxy_pass http://traffic_api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for video processing
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
    
    location / {
        # React frontend static files
        root /var/www/traffic-frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/traffic-detector /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 Security Hardening

### 1. API Authentication
Update `api_server.py` to add API key validation:
```python
from functools import wraps
import os

API_KEY = os.environ.get('TRAFFIC_API_KEY', 'your-secret-key')

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        key = request.headers.get('X-API-Key')
        if not key or key != API_KEY:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/detect', methods=['POST'])
@require_api_key
def detect_vehicles():
    # ... existing code
```

### 2. Rate Limiting
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(app, key_func=get_remote_address)

@app.route('/detect', methods=['POST'])
@limiter.limit("10 per minute")
def detect_vehicles():
    # ... existing code
```

### 3. Input Validation
```python
MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB

def validate_image_size(data):
    if len(data) > MAX_IMAGE_SIZE:
        raise ValueError(f"Image too large: {len(data)} bytes")
```

### 4. CORS Configuration
```python
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {
        "origins": ["https://your-domain.com"],
        "methods": ["GET", "POST"],
        "max_age": 3600
    }
})
```

## 📊 Monitoring & Logging

### 1. Application Logging
```python
import logging
import logging.handlers

# Configure logging
log_handler = logging.handlers.RotatingFileHandler(
    '/var/log/traffic-detector/app.log',
    maxBytes=10485760,  # 10MB
    backupCount=10
)
logger = logging.getLogger('traffic_detector')
logger.addHandler(log_handler)
logger.setLevel(logging.INFO)

# Log detection events
logger.info(f"Detection completed: {results['vehicle_count']} vehicles")
```

### 2. System Monitoring
```bash
# Monitor API health
watch -n 5 'curl -s http://localhost:5000/health'

# Monitor logs
tail -f /var/log/traffic-detector/access.log
tail -f /var/log/traffic-detector/error.log

# Check resource usage
ps aux | grep gunicorn
free -m
df -h
```

### 3. Performance Metrics
Add to `api_server.py`:
```python
import time
from prometheus_client import Counter, Histogram

detection_counter = Counter(
    'detections_total',
    'Total detection requests'
)

detection_time = Histogram(
    'detection_duration_seconds',
    'Time spent detecting vehicles'
)

@app.route('/detect', methods=['POST'])
def detect_vehicles():
    start_time = time.time()
    try:
        # ... detection logic
        detection_counter.inc()
    finally:
        detection_time.observe(time.time() - start_time)
```

## 🔄 Backup & Recovery

### 1. Database Backup (if applicable)
```bash
#!/bin/bash
# Backup detection results
BACKUP_DIR="/backups/traffic-detector"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp -r /opt/traffic-detector/data $BACKUP_DIR/data_$DATE
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/data_$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete
```

### 2. Configuration Backup
```bash
sudo cp -r /etc/nginx/sites-available/traffic-detector /backups/
sudo cp /opt/traffic-detector/gunicorn_config.py /backups/
```

## 🎯 Load Balancing (Optional)

For high traffic, set up multiple API instances:

```bash
# Instance 1: Port 5001
FLASK_PORT=5001 gunicorn api_server:app

# Instance 2: Port 5002  
FLASK_PORT=5002 gunicorn api_server:app

# Nginx load balancing
upstream traffic_api_pool {
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    least_conn;
}
```

## 📱 Docker Deployment (Optional)

Create `Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt gunicorn

# Copy application
COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "api_server:app"]
```

Build and run:
```bash
docker build -t traffic-detector:latest .
docker run -p 5000:5000 traffic-detector:latest
```

## 🧪 Testing Production Setup

```bash
# Test API health
curl -s https://your-domain.com/api/health | jq

# Test detection
curl -X POST https://your-domain.com/api/detect \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"image": "base64_image_here"}'

# Load testing
ab -n 100 -c 10 https://your-domain.com/api/health
```

## 📈 Scaling Considerations

1. **Horizontal Scaling**: Run multiple Gunicorn instances behind Nginx
2. **Caching**: Implement Redis for detector configuration caching
3. **Queue Processing**: Use Celery for batch detection jobs
4. **Database**: Use PostgreSQL for storing detection history
5. **CDN**: Cache static assets on CDN for faster delivery

## 🆘 Troubleshooting Production Issues

### High Memory Usage
```bash
# Restart service to free memory
sudo systemctl restart traffic-detector

# Adjust worker count in gunicorn_config.py
workers = 2  # Reduce from default
```

### Slow Detection
```bash
# Check system load
top

# Increase Gunicorn workers if CPU underutilized
workers = 8

# Adjust detector scale_factor for faster processing
curl -X POST /api/config -d '{"scale_factor": 1.2}'
```

### API Gateway Timeout
```
# Increase nginx proxy_read_timeout
proxy_read_timeout 180s;
```

## 📞 Support & Maintenance

- **Monitoring**: Set up alerts for API downtime
- **Updates**: Regularly update system packages and Python dependencies
- **Logs**: Archive and retain logs for audit trail
- **Performance**: Periodically review and optimize detector parameters

---

**Ready for Production Deployment! 🚀**
