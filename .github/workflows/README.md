# GitHub Actions Workflows

This directory contains CI/CD workflows for Lord of the Bins.

## Workflows

### 1. CI (`ci.yml`)

**Trigger:** Push or PR to `main` or `develop` branches

**Purpose:** Build verification and artifact generation

**Steps:**
- Type checking with TypeScript
- Production build
- Artifact upload (7-day retention)

**No secrets required** - This workflow runs out of the box.

---

### 2. Claude Code Review (`claude-code-review.yml`)

**Trigger:** PR opened, synchronized, or marked ready for review

**Purpose:** Automated code review using Claude AI

**Required Secret:**
```
CLAUDE_CODE_OAUTH_TOKEN
```

**How to configure:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CLAUDE_CODE_OAUTH_TOKEN`
4. Value: Your Claude Code OAuth token from https://claude.ai/settings
5. Click "Add secret"

**Alternative:** Use `CLAUDE_API_KEY` instead (for Anthropic API key)

---

### 3. Security Review (`security-review.yml`)

**Trigger:** Any pull request

**Purpose:** Security vulnerability scanning using Claude AI

**Required Secret:**
```
ANTHROPIC_API_KEY
```

**How to configure:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `ANTHROPIC_API_KEY`
4. Value: Your Anthropic API key from https://console.anthropic.com/
5. Click "Add secret"

---

## Quick Setup Checklist

- [ ] Basic CI works immediately (no setup needed)
- [ ] For Claude Code Review: Add `CLAUDE_CODE_OAUTH_TOKEN` secret
- [ ] For Security Review: Add `ANTHROPIC_API_KEY` secret
- [ ] Test workflows by creating a draft PR

## Workflow Customization

### Changing Claude Model

To use a different Claude model, update the `claude-model` parameter:

```yaml
# In claude-code-review.yml
claude_args: '--model claude-opus-4-5-20250929 ...'

# In security-review.yml
claude-model: claude-opus-4-5-20250929
```

Available models: `claude-opus-4-5-20250929`, `claude-sonnet-4-5-20250929`

### Adjusting Build Steps

Edit `ci.yml` to add steps like linting or testing:

```yaml
- name: Run tests
  run: npm test

- name: Lint code
  run: npm run lint
```

## Troubleshooting

**CI workflow fails on type check:**
- Run `npx tsc --noEmit` locally to see errors
- Fix TypeScript errors before pushing

**Claude review doesn't run:**
- Check that secrets are configured correctly
- Verify PR is not from a fork (secrets aren't exposed to forks)
- Check Actions tab for error logs

**Security review fails:**
- Ensure `ANTHROPIC_API_KEY` is valid
- Check API rate limits on Anthropic console

## Cost Considerations

**Claude Code Review:** Uses Claude Opus (most expensive model)
- Estimated cost: $0.50 - $2.00 per review
- Only runs on PRs (not every commit)

**Security Review:** Uses Claude Opus
- Estimated cost: $0.30 - $1.50 per review
- Runs on every PR

**Tip:** Consider using Claude Sonnet for cost savings (90% cheaper, still high quality)
