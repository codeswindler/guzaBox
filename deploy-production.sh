#!/bin/bash

# Kwachua Box Production Deployment Script
# For deployment to /var/www/guzabox

echo "🚀 Kwachua Box Production Deployment"
echo "=================================="

# Set variables
BACKUP_DIR="/var/backups/guzabox"
DEPLOY_DIR="/var/www/guzabox"
REPO_DIR="/tmp/guzabox-deploy"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "📅 Deployment timestamp: $TIMESTAMP"

# Create backup directory if it doesn't exist
sudo mkdir -p $BACKUP_DIR

# Backup current deployment
if [ -d "$DEPLOY_DIR" ]; then
    echo "💾 Backing up current deployment..."
    sudo cp -r $DEPLOY_DIR $BACKUP_DIR/guzabox_backup_$TIMESTAMP
    echo "✅ Backup created: $BACKUP_DIR/guzabox_backup_$TIMESTAMP"
fi

# Clone latest code
echo "📥 Cloning latest code..."
rm -rf $REPO_DIR
git clone https://github.com/yourusername/guzabox.git $REPO_DIR
cd $REPO_DIR

# Checkout production branch (adjust as needed)
git checkout main

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd $REPO_DIR/backend
npm ci --production

# Install frontend dependencies and build
echo "🏗️ Building frontend..."
cd $REPO_DIR/dashboard
npm ci
npm run build

# Stop services
echo "⏹️ Stopping services..."
sudo systemctl stop guzabox-backend || true
sudo systemctl stop nginx || true

# Deploy backend
echo "🚀 Deploying backend..."
sudo rm -rf $DEPLOY_DIR/backend
sudo cp -r $REPO_DIR/backend $DEPLOY_DIR/
sudo chown -R www-data:www-data $DEPLOY_DIR/backend

# Deploy frontend
echo "🎨 Deploying frontend..."
sudo rm -rf $DEPLOY_DIR/dashboard
sudo cp -r $REPO_DIR/dashboard $DEPLOY_DIR/
sudo cp -r $REPO_DIR/dashboard/.next $DEPLOY_DIR/dashboard/
sudo chown -R www-data:www-data $DEPLOY_DIR/dashboard

# Run database migration
echo "🗄️ Running database migration..."
cd $DEPLOY_DIR/backend
# Apply the wonAmount column migration
mysql -u your_db_user -p your_db_name < migrations/001_add_won_amount.sql

# Update environment file
echo "⚙️ Updating environment..."
if [ ! -f "$DEPLOY_DIR/backend/.env" ]; then
    sudo cp $DEPLOY_DIR/backend/.env.example $DEPLOY_DIR/backend/.env
    echo "⚠️ Please update $DEPLOY_DIR/backend/.env with production values!"
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Start backend with PM2
echo "🔄 Starting backend..."
cd $DEPLOY_DIR/backend
sudo -u www-data pm2 delete guzabox-backend || true
sudo -u www-data pm2 start npm --name "guzabox-backend" -- run start

# Save PM2 configuration
sudo -u www-data pm2 save
sudo -u www-data pm2 startup

# Configure nginx (if not already configured)
echo "🌐 Configuring nginx..."
if [ ! -f "/etc/nginx/sites-available/guzabox" ]; then
    sudo tee /etc/nginx/sites-available/guzabox > /dev/null <<EOF
server {
    listen 80;
    server_name micdelight.goldentranscripts.net;

    # Frontend
    location / {
        root $DEPLOY_DIR/dashboard;
        try_files \$uri \$uri/ @nextjs;
    }

    location @nextjs {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # USSD endpoints
    location /ussd {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # M-Pesa callback
    location /payments/mpesa-callback {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Enable site
    sudo ln -s /etc/nginx/sites-available/guzabox /etc/nginx/sites-enabled/
    sudo nginx -t
fi

# Start nginx
echo "🌐 Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Start frontend
echo "🎨 Starting frontend..."
cd $DEPLOY_DIR/dashboard
sudo -u www-data pm2 delete guzabox-frontend || true
sudo -u www-data pm2 start npm --name "guzabox-frontend" -- run start

# Save PM2 configuration
sudo -u www-data pm2 save

# Cleanup
echo "🧹 Cleaning up..."
rm -rf $REPO_DIR

# Verify services
echo "🔍 Verifying services..."
sleep 5

# Check backend
if curl -f http://localhost:4000/admin/instant-win/status > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend failed to start"
fi

# Check frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend failed to start"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo "📍 Deployment directory: $DEPLOY_DIR"
echo "💾 Backup location: $BACKUP_DIR/guzabox_backup_$TIMESTAMP"
echo "🌐 URL: https://micdelight.goldentranscripts.net"
echo ""
echo "📋 Next Steps:"
echo "1. Update $DEPLOY_DIR/backend/.env with production values"
echo "2. Test the instant gratification system"
echo "3. Verify M-Pesa callbacks are working"
echo "4. Check admin dashboard functionality"
echo ""
echo "🔧 PM2 Commands:"
echo "pm2 status                    # Check service status"
echo "pm2 logs guzabox-backend      # View backend logs"
echo "pm2 logs guzabox-frontend     # View frontend logs"
echo "pm2 restart guzabox-backend   # Restart backend"
echo "pm2 restart guzabox-frontend  # Restart frontend"
