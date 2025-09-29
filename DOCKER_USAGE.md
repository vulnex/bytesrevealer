# Docker Configuration Options for BytesRevealer

BytesRevealer provides two Docker configurations to suit different deployment needs:

## Option 1: Nginx-based (Recommended for Production)

**Files:**
- `Dockerfile.nginx` - Multi-stage build with Nginx
- `docker-compose.nginx.yml` - Optimized production deployment
- `nginx/nginx-optimized.conf` - High-performance Nginx configuration

### Advantages:
- ✅ **Smaller image size** (~40MB vs ~170MB)
- ✅ **Better performance** for static files
- ✅ **Lower memory usage** (64-128MB)
- ✅ **Production-optimized** with caching, compression, and security headers
- ✅ **Native HTTP server** performance
- ✅ **PWA and Service Worker support**

### Usage:
```bash
# Build the image
docker-compose -f docker-compose.nginx.yml build

# Run the container
docker-compose -f docker-compose.nginx.yml up -d

# Stop the container
docker-compose -f docker-compose.nginx.yml down
```

### Features:
- Full PWA support with service worker
- Optimized caching strategies
- Gzip compression
- Security headers (X-Frame-Options, CSP, etc.)
- Health checks
- Resource limits (CPU: 0.5, Memory: 128MB)
- Non-root user for security

---

## Option 2: Node.js with Serve (Current Default)

**Files:**
- `Dockerfile` - Multi-stage build with Node.js
- `docker-compose.yml` - Standard deployment

### Advantages:
- ✅ **Development consistency** (same as Vite dev server)
- ✅ **Easier debugging** with Node.js
- ✅ **Potential for server-side features** in future
- ✅ **Built-in SPA routing** with serve package

### Usage:
```bash
# Build the image
docker-compose build

# Run the container
docker-compose up -d

# Stop the container
docker-compose down
```

### Features:
- Simple configuration
- Health checks
- Auto-restart on failure
- Development-friendly

---

## Comparison Table

| Feature | Nginx | Node.js + Serve |
|---------|-------|-----------------|
| Image Size | ~40MB | ~170MB |
| Memory Usage | 64-128MB | 256-512MB |
| CPU Usage | Very Low | Low-Medium |
| Static File Performance | Excellent | Good |
| Gzip Compression | Native | Via Serve |
| Caching Control | Advanced | Basic |
| Security Headers | Configured | Basic |
| PWA Support | Full | Full |
| Build Time | Fast | Fast |
| Production Ready | Yes ✅ | Yes |

---

## Which Should You Use?

### Use **Nginx** (docker-compose.nginx.yml) when:
- Deploying to production
- Resource constraints (VPS, cloud)
- Need maximum performance
- Serving high traffic
- Want smallest footprint

### Use **Node.js** (docker-compose.yml) when:
- Development environment
- Need consistency with dev server
- Planning server-side features
- Quick testing and demos

---

## Quick Commands

### Nginx Version:
```bash
# Build and run
docker-compose -f docker-compose.nginx.yml up -d --build

# View logs
docker-compose -f docker-compose.nginx.yml logs -f

# Check health
docker-compose -f docker-compose.nginx.yml ps

# Stop and remove
docker-compose -f docker-compose.nginx.yml down
```

### Node.js Version:
```bash
# Build and run
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check health
docker-compose ps

# Stop and remove
docker-compose down
```

---

## Testing Both Configurations

To test both side by side:

```bash
# Start Nginx version on port 8080
docker-compose -f docker-compose.nginx.yml up -d

# Modify docker-compose.yml to use port 8081
# Then start Node version
docker-compose up -d

# Access Nginx version: http://localhost:8080
# Access Node version: http://localhost:8081
```

---

## Production Deployment

For production, we recommend using the **Nginx configuration** with these additional steps:

1. Add SSL/TLS termination (via reverse proxy or Docker)
2. Configure proper domain names
3. Set up monitoring (Prometheus, Grafana)
4. Configure log aggregation
5. Set up automated backups
6. Use Docker Swarm or Kubernetes for orchestration

---

## Environment Variables

Both configurations support environment variables:

### Nginx Version:
```yaml
environment:
  - TZ=America/New_York  # Timezone
```

### Node Version:
```yaml
environment:
  - NODE_ENV=production
  - TZ=America/New_York
```

---

## Notes

- Both configurations are production-ready
- Nginx version is more resource-efficient
- Node version offers more flexibility for future features
- Both support all BytesRevealer features including PWA
- Health checks ensure high availability
- Auto-restart policies prevent downtime