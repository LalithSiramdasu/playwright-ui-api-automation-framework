# Publish the project as a new public GitHub repository

The current connected GitHub integration supports reading repositories and writing to existing ones, but **does not expose creating a new repository**. This project therefore comes as files/ZIP to upload to your own new public repository; do not put it into an unrelated existing repository.

## Easiest method: GitHub website + local Git

1. Sign in at https://github.com/new.
2. Set **Repository name** to `playwright-ui-api-automation-framework` (or a name you prefer).
3. Select **Public**. Don't select “Add a README,” “Add .gitignore,” or a license; all three are already in these project files.
4. Click **Create repository**.
5. Extract the ZIP into a project folder. Open a terminal in that folder.
6. Run the following commands, replacing `<YOUR_GITHUB_USERNAME>` with your account username:

```bash
git init
git add .
git commit -m "Build personal Playwright UI and API automation framework"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/playwright-ui-api-automation-framework.git
git push -u origin main
```

If prompted for GitHub authentication, use GitHub's supported credential-manager or browser sign-in. Do not share a password or personal access token in chat, code, or a public repository.

## Verify the publication

1. Open the new public GitHub repository and confirm the README, source folders, and `.github/workflows/playwright.yml` are present.
2. Open the **Actions** tab. The workflow should run after the push; if GitHub requires workflow approval, explicitly approve it.
3. Wait for the full workflow result, read any failures, and fix them before claiming CI is green.
4. Use the repository's link in your portfolio once you understand and can demonstrate the tests.

## Alternative: upload files through the website

You can use **Add file → Upload files** in an empty repo. However, some hidden files (such as `.github/workflows/`) can be easy to miss when uploading manually. Local Git is the more reliable option.
