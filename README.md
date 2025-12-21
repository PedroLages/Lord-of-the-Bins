<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1hxGp24-kdzBtjvvfD70oEFY2L2BB3VDP

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## CI/CD Workflow

This project uses GitHub Actions for automated testing and quality checks:

- ✅ **Continuous Integration** - TypeScript type checking and build verification
- ✅ **Code Review** - Automated AI-powered code quality reviews (optional)
- ✅ **Security Scanning** - Automated vulnerability detection (optional)

All pull requests must pass CI checks before merging. See [CLAUDE.md](CLAUDE.md) for the complete git workflow.
