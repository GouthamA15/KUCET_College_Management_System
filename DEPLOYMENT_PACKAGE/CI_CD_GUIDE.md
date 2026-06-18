
## 9. Automatic GitHub Deployment (CI/CD)
**[LOCATION: RUN ON YOUR LOCAL SERVER & GITHUB DASHBOARD]**

To prevent giving GitHub root access to your server, we use a dedicated deployment user with restricted permissions.

### 9.1 Create the Deployment User (On Server)
````bash
# 1. Create a user named 'deployer'
sudo adduser deployer
# 2. Add deployer to the docker group
sudo usermod -aG docker deployer
# 3. Give deployer ownership of the project folder
sudo chown -R deployer:deployer /var/www/kucet-cms
```

### 9.2 Setup SSH Keys for 'deployer' (On Server)
````bash
# Switch to the deployer user
sudo su - deployer
# Generate an SSH key pair (No passphrase)
ssh-keygen -t ed25519 -C "github-actions-deploy"
# Add the public key to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# Copy the PRIVATE key (including BEGIN/END lines) to GitHub
cat ~/.ssh/id_ed25519
exit
```

### 9.3 Configure GitHub Secrets
Add these to Repository Settings -> Secrets -> Actions:
*   `SERVER_HOST`: The Tailscale or Public IP of the server.
*   `SERVER_USER`: `deployer`
*   `SERVER_SSH_KEY`: The entire private key (including BEGIN/END markers).

### 9.4 Deployment Trigger
The workflow triggers on pushes to **`testvanilla`**. Ensure the server is tracking this branch:
```bash
cd /var/www/kucet-cms
git checkout testvanilla
```
