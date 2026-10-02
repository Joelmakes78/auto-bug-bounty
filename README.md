name: Passive Subdomain Recon Pipeline

on:
  schedule:
    # Runs automatically every day at 00:00 UTC
    - cron: '0 0 * * *'
  workflow_dispatch:
    inputs:
      target:
        description: 'Target Domain (e.g., example.com)'
        required: false
        default: 'example.com'

env:
  # Default target domain for scheduled cron runs
  DEFAULT_TARGET: 'example.com'

jobs:
  passive-recon:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Go Environment
        uses: actions/setup-go@v5
        with:
          go-version: 'stable'

      - name: Install Passive Recon Tools
        run: |
          go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
          go install -v github.com/tomnomnom/assetfinder@latest

      - name: Execute Passive Subdomain Discovery
        run: |
          # Determine target from manual input or default env variable
          TARGET="${{ github.event.inputs.target || env.DEFAULT_TARGET }}"
          echo "Target set to: $TARGET"
          
          # Run subfinder and assetfinder in passive mode
          ~/go/bin/subfinder -d "$TARGET" -silent > subfinder_raw.txt
          ~/go/bin/assetfinder --subs-only "$TARGET" > assetfinder_raw.txt
          
          # Merge, filter for the domain, sort, and remove duplicates
          cat subfinder_raw.txt assetfinder_raw.txt | grep -E "\b[A-Za-z0-9.-]+\.$TARGET\b" | sort -u > subdomains.txt
          
          # Count findings
          COUNT=$(wc -l < subdomains.txt)
          
          # Pass variables to next step
          echo "FOUND_COUNT=$COUNT" >> $GITHUB_ENV
          echo "CURRENT_TARGET=$TARGET" >> $GITHUB_ENV

      - name: Send Notification to Discord Webhook
        if: env.FOUND_COUNT > 0
        run: |
          # Upload subdomains.txt as an attachment to bypass Discord's 2,000 character text limit
          curl -X POST \
            -F "content=🔍 **Passive Subdomain Recon Complete**\n**Target:** \`${{ env.CURRENT_TARGET }}\`\n**Unique Subdomains Found:** \`${{ env.FOUND_COUNT }}\`" \
            -F "file=@subdomains.txt" \
            "${{ secrets.DISCORD_WEBHOOK }}"
# auto-bug-bounty