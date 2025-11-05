# GitHub Upload Guide - QUDyMa Publications Database

This guide will help you upload this repository to your GitHub organization.

## Prerequisites

1. You need to be a member of the GitHub organization
2. You need permission to create repositories in the organization
3. Git must be installed on your computer
4. You need a GitHub account with SSH key or personal access token set up

## Step 1: Prepare the Repository

First, let's make sure sensitive files are not committed:

```bash
cd /Users/carlospaya/Library/CloudStorage/Nextcloud-50246982d@saco.csic.es/PhD/Code/qudyma_db

# Create .gitignore file
cat > .gitignore << 'EOF'
# Sensitive configuration
config/orcid_oauth.json

# Generated data (these will be regenerated)
data/arxiv_publications.json
data/orcid_publications.json
data/publications.json

# Node modules (if any)
node_modules/

# System files
.DS_Store
.vscode/
.idea/

# Temporary files
*.tmp
*.log
/tmp/

# Environment files
.env
.env.local
EOF
```

## Step 2: Create Example Credential File

Create a template for ORCID credentials (without real credentials):

```bash
cat > config/orcid_oauth.json.example << 'EOF'
{
  "access_token": "YOUR_ORCID_ACCESS_TOKEN_HERE",
  "token_type": "bearer",
  "expires_in": 631138518,
  "scope": "/read-public",
  "orcid": null
}
EOF
```

## Step 3: Create GitHub Repository in Organization

### Option A: Via GitHub Website (Recommended for first-time users)

1. Go to https://github.com/orgs/YOUR_ORG_NAME/repositories
   - Replace `YOUR_ORG_NAME` with your actual organization name

2. Click the green "New repository" button

3. Fill in the details:
   - **Repository name**: `qudyma-publications` (or your preferred name)
   - **Description**: "Publications database for QUDyMa research group - fetches and merges publications from arXiv and ORCID"
   - **Visibility**: 
     - Choose "Public" if you want it open source
     - Choose "Private" if you want to keep it internal
   - **Initialize**: Leave unchecked (we already have files)

4. Click "Create repository"

5. Copy the repository URL shown (you'll need this in Step 4)

### Option B: Via GitHub CLI (if you have `gh` installed)

```bash
# Replace YOUR_ORG_NAME with your organization name
gh repo create YOUR_ORG_NAME/qudyma-publications \
  --description "Publications database for QUDyMa research group" \
  --public  # or --private
```

## Step 4: Initialize Git and Push to GitHub

```bash
cd /Users/carlospaya/Library/CloudStorage/Nextcloud-50246982d@saco.csic.es/PhD/Code/qudyma_db

# Initialize git repository
git init

# Add all files
git add .

# Check what will be committed (verify orcid_oauth.json is NOT listed)
git status

# Make initial commit
git commit -m "Initial commit: QUDyMa Publications Database

- Modular API for website integration
- CLI tool for managing publications
- Automatic fetching from arXiv and ORCID
- Journal name standardization
- Author name normalization
- Highlights integration (coverage and awards)
- Complete documentation and integration examples"

# Add the GitHub remote (replace URL with your actual repository URL)
# Format: git remote add origin git@github.com:YOUR_ORG_NAME/qudyma-publications.git
git remote add origin git@github.com:YOUR_ORG_NAME/qudyma-publications.git

# Push to GitHub
git push -u origin main
```

**If you get an error about 'main' not existing**, try:
```bash
git branch -M main
git push -u origin main
```

## Step 5: Verify Upload

1. Go to https://github.com/YOUR_ORG_NAME/qudyma-publications
2. Verify all files are there
3. Verify `config/orcid_oauth.json` is NOT there (security!)
4. Check that README.md displays correctly

## Step 6: Set Up Repository Settings (Recommended)

### Add Topics/Tags
1. Go to repository homepage
2. Click the gear icon next to "About"
3. Add topics: `publications`, `arxiv`, `orcid`, `research`, `academic`, `nodejs`

### Add Branch Protection (Optional)
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable "Require pull request reviews before merging" if working with team

### Add Collaborators (if needed)
1. Go to Settings → Collaborators and teams
2. Add team members with appropriate permissions

## Step 7: Set Up Secrets for Website Integration

If your organization's website repository needs to access this:

1. Go to your website repository
2. Settings → Secrets and variables → Actions
3. Add secret: `ORCID_ACCESS_TOKEN` with your ORCID token value

Then in your website's workflow or code:
```javascript
// In your website code
const orcidOAuth = {
    access_token: process.env.ORCID_ACCESS_TOKEN,
    token_type: "bearer"
};
```

## Step 8: Link to Website Repository (Optional)

If you want to reference this in your website repo:

### Option A: Git Submodule
```bash
cd /path/to/website/repository
git submodule add git@github.com:YOUR_ORG_NAME/qudyma-publications.git qudyma_db
```

### Option B: npm Package (if you make it one)
```bash
# In your website repo
npm install git+ssh://git@github.com:YOUR_ORG_NAME/qudyma-publications.git
```

### Option C: Copy Integration Code
Just copy the integration example from this repo to your website repo.

## Step 9: Document in Website Repository

Add to your website's README:

```markdown
## Publications Database

Publications are managed via the [qudyma-publications](https://github.com/YOUR_ORG_NAME/qudyma-publications) repository.

To update publications:
1. Edit configs in that repository
2. Run `node cli.js generate`
3. Copy `data/publications.json` to this website repo (or use API)
```

## Quick Reference: Common Git Commands

```bash
# After making changes to files
git add .
git commit -m "Description of changes"
git push

# Create a new branch for features
git checkout -b feature/add-researcher
git push -u origin feature/add-researcher

# Update from remote
git pull

# Check status
git status

# View commit history
git log --oneline
```

## Troubleshooting

### "Permission denied (publickey)"
- Set up SSH key: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- Or use HTTPS instead: `git remote set-url origin https://github.com/YOUR_ORG_NAME/qudyma-publications.git`

### "Repository not found"
- Check organization name is correct
- Verify you have access to the organization
- Make sure repository was created successfully

### "orcid_oauth.json was committed by mistake"
```bash
# Remove from git but keep local file
git rm --cached config/orcid_oauth.json
git commit -m "Remove sensitive credentials file"
git push
```

### "Need to add more files to .gitignore"
```bash
# Edit .gitignore
echo "additional/file/pattern" >> .gitignore
git add .gitignore
git commit -m "Update .gitignore"
git push
```

## Security Checklist

Before pushing, verify:
- [ ] `config/orcid_oauth.json` is in .gitignore
- [ ] No API keys or passwords in any file
- [ ] `orcid_oauth.json.example` exists (without real credentials)
- [ ] README explains how to set up credentials

## Next Steps After Upload

1. **Share with team**: Send repository link to collaborators
2. **Set up CI/CD** (optional): Automate publication generation
3. **Link from website**: Add reference in website repository
4. **Document workflow**: Add CONTRIBUTING.md if others will contribute

---

**Ready to upload?** Start with Step 1 above!

**Organization name needed**: Replace `YOUR_ORG_NAME` throughout with your actual GitHub organization name.
