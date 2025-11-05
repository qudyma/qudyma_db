# GitHub Actions Setup Guide

This repository uses GitHub Actions to automatically update the publications database weekly.

## 🔧 Setup Instructions

### Step 1: Upload Repository to GitHub

Follow the instructions in `GITHUB_UPLOAD.md` to create and push the repository to your organization.

### Step 2: Configure ORCID Credentials Secret

1. **Go to your repository on GitHub**
   - Navigate to: `https://github.com/YOUR-ORG-NAME/YOUR-REPO-NAME`

2. **Open Settings**
   - Click on "Settings" tab in the repository

3. **Navigate to Secrets**
   - In the left sidebar, click "Secrets and variables" → "Actions"

4. **Create New Secret**
   - Click the green "New repository secret" button
   - **Name:** `ORCID_OAUTH_JSON`
   - **Value:** Copy and paste the **entire contents** of your local `config/orcid_oauth.json` file
   
   Your secret value should look like:
   ```json
   {
     "access_token": "your-actual-token-here",
     "token_type": "bearer",
     "expires_in": 631138518,
     "scope": "/read-public",
     "orcid": null
   }
   ```

5. **Save the Secret**
   - Click "Add secret"

### Step 3: Verify Workflow File

The workflow file is already created at `.github/workflows/update-publications.yml`

It will:
- ✅ Run every Sunday at midnight UTC
- ✅ Allow manual triggering from GitHub UI
- ✅ Fetch data from arXiv and ORCID
- ✅ Generate `publications.json`
- ✅ Commit changes if data has changed
- ✅ Skip commit if no changes detected

### Step 4: Enable GitHub Actions

1. Go to repository "Settings" → "Actions" → "General"
2. Under "Actions permissions", select "Allow all actions and reusable workflows"
3. Under "Workflow permissions", select "Read and write permissions"
4. Click "Save"

### Step 5: Initial Manual Run (Optional but Recommended)

Test that everything works:

1. Go to "Actions" tab in your repository
2. Click on "Update Publications Database" workflow
3. Click "Run workflow" dropdown
4. Click the green "Run workflow" button
5. Wait for the workflow to complete (should take 1-2 minutes)
6. Check the "Actions" tab for success/failure

## 📅 Automatic Update Schedule

The workflow runs automatically:
- **Weekly:** Every Sunday at 00:00 UTC
- **Manual:** Anytime via GitHub UI (Actions tab → Run workflow)

## 🔍 Monitoring Updates

### View Workflow Runs
1. Go to "Actions" tab in your repository
2. See all past runs of "Update Publications Database"
3. Click on any run to see detailed logs

### Check Latest Update
- Look at the commit history for commits by "GitHub Actions Bot"
- Message will be: "Auto-update publications database [skip ci]"
- The `[skip ci]` tag prevents infinite loops

### View Changes
- Click on any auto-update commit
- See the diff of `data/publications.json`
- Shows new publications added or metadata updated

## 🔧 Customizing the Schedule

Edit `.github/workflows/update-publications.yml`:

```yaml
schedule:
  - cron: '0 0 * * 0'  # Current: Weekly on Sunday at midnight
  # - cron: '0 0 * * *'   # Daily at midnight
  # - cron: '0 0 1 * *'   # Monthly on the 1st
  # - cron: '0 */6 * * *' # Every 6 hours
```

Cron format: `minute hour day month day-of-week`
- All times are in UTC
- Use [crontab.guru](https://crontab.guru/) to validate schedules

## 🚨 Troubleshooting

### Workflow Fails

**Check the error logs:**
1. Go to "Actions" tab
2. Click on the failed workflow run
3. Expand the failed step to see error message

**Common Issues:**

**Error: "ORCID_OAUTH_JSON secret not found"**
- Solution: Go to Settings → Secrets → Actions and verify secret exists
- Check spelling: must be exactly `ORCID_OAUTH_JSON`

**Error: "Permission denied" or "failed to push"**
- Solution: Enable write permissions in Settings → Actions → General → Workflow permissions

**Error: "wget: command not found"**
- Solution: Workflow installs wget, but if this fails, check the install step logs

**Error: "node: command not found"**
- Solution: Verify Node.js setup step completed successfully

**Error: ORCID API authentication failed**
- Solution: Your ORCID token may have expired
- Get a new token and update the secret in GitHub

### No New Publications

If the workflow runs but doesn't commit:
- This is normal! It means no new publications were found
- Check the workflow log for "No changes detected"
- Publications are only committed when data actually changes

### Manual Update Needed

To force an update immediately:
1. Go to "Actions" tab
2. Click "Update Publications Database"
3. Click "Run workflow" → "Run workflow"

## 🔒 Security Notes

- ✅ ORCID credentials are stored as encrypted GitHub Secrets
- ✅ Secrets are never exposed in logs or commits
- ✅ Only Actions with explicit permission can access secrets
- ✅ The `config/orcid_oauth.json` file is never committed (see `.gitignore`)

## 📊 Integration with Website

Your website (GitHub Pages or other) should:

1. **Load the static file:**
   ```javascript
   fetch('https://raw.githubusercontent.com/YOUR-ORG/YOUR-REPO/main/data/publications.json')
     .then(r => r.json())
     .then(data => console.log(data));
   ```

2. **Or use as submodule/package** (see INTEGRATION.md)

3. **Data is automatically fresh** - updated weekly by GitHub Actions

## 📝 Optional: Trigger on Config Changes

To auto-update when you modify researcher info:

Uncomment these lines in `.github/workflows/update-publications.yml`:

```yaml
push:
  branches: [ main ]
  paths:
    - 'config/basics.json'
    - 'config/highlights.json'
```

This will trigger an update whenever you:
- Add a new researcher to `basics.json`
- Update highlights in `highlights.json`

## 🎯 Next Steps

1. ✅ Push repository to GitHub (if not already done)
2. ✅ Add `ORCID_OAUTH_JSON` secret
3. ✅ Enable GitHub Actions permissions
4. ✅ Run workflow manually to test
5. ✅ Verify `publications.json` gets updated
6. ✅ Integrate with your website

---

**Questions?** Check the workflow logs in the Actions tab for detailed information about each run.
