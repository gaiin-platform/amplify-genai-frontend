#!/bin/bash

# monitor-callback-loop.sh

DOMAIN="https://hfu-amplify.org"
LOG_FILE="auth-flow-monitor.log"
MAX_REDIRECTS=10

echo "=== Monitoring Authentication Callback Loop ==="
echo "Monitoring started at: $(date)" | tee -a $LOG_FILE

# Function to follow redirects manually
follow_redirects() {
    local url=$1
    local count=0
    local visited_urls=()
    
    echo -e "\nStarting redirect chain from: $url" | tee -a $LOG_FILE
    
    while [ $count -lt $MAX_REDIRECTS ]; do
        # Check if we've seen this URL before (loop detection)
        for visited in "${visited_urls[@]}"; do
            if [ "$visited" = "$url" ]; then
                echo -e "❌ CALLBACK LOOP DETECTED!" | tee -a $LOG_FILE
                echo "URL appeared twice: $url" | tee -a $LOG_FILE
                return 1
            fi
        done
        
        visited_urls+=("$url")
        
        # Get headers
        response=$(curl -s -I -L --max-redirs 0 "$url")
        status=$(echo "$response" | grep -E "^HTTP" | tail -1 | awk '{print $2}')
        location=$(echo "$response" | grep -i "^Location:" | sed 's/Location: //i' | tr -d '\r')
        
        echo "[$count] $url -> HTTP $status" | tee -a $LOG_FILE
        
        if [ -n "$location" ]; then
            # Handle relative URLs
            if [[ "$location" =~ ^/ ]]; then
                location="${DOMAIN}${location}"
            fi
            url="$location"
            ((count++))
        else
            echo "Redirect chain completed successfully" | tee -a $LOG_FILE
            return 0
        fi
    done
    
    echo "❌ Max redirects ($MAX_REDIRECTS) exceeded!" | tee -a $LOG_FILE
    return 1
}

# Test the signin flow
echo -e "\n--- Testing Sign In Flow ---" | tee -a $LOG_FILE
signin_url="${DOMAIN}/api/auth/signin?callbackUrl=${DOMAIN}"
follow_redirects "$signin_url"

# Test the callback flow
echo -e "\n--- Testing Callback Flow ---" | tee -a $LOG_FILE
callback_url="${DOMAIN}/api/auth/callback/cognito?code=test&state=test"
follow_redirects "$callback_url"

echo -e "\nMonitoring completed at: $(date)" | tee -a $LOG_FILE