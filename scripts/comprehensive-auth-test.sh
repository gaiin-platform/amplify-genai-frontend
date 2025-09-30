#!/bin/bash

# comprehensive-auth-test.sh

DOMAIN="https://hfu-amplify.org"
RESULTS_FILE="auth-test-results-$(date +%Y%m%d-%H%M%S).log"

echo "=== Comprehensive Authentication Test Suite ===" | tee $RESULTS_FILE
echo "Test started: $(date)" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=$3
    
    echo -n "Testing: $test_name... " | tee -a $RESULTS_FILE
    
    result=$(eval $test_command 2>/dev/null)
    
    if [ "$result" = "$expected_result" ]; then
        echo "✅ PASSED" | tee -a $RESULTS_FILE
        ((TESTS_PASSED++))
        return 0
    else
        echo "❌ FAILED (Expected: $expected_result, Got: $result)" | tee -a $RESULTS_FILE
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to test contains
run_test_contains() {
    local test_name=$1
    local test_command=$2
    local expected_substring=$3
    
    echo -n "Testing: $test_name... " | tee -a $RESULTS_FILE
    
    result=$(eval $test_command 2>/dev/null)
    
    if [[ "$result" == *"$expected_substring"* ]]; then
        echo "✅ PASSED" | tee -a $RESULTS_FILE
        ((TESTS_PASSED++))
        return 0
    else
        echo "❌ FAILED (Expected to contain: $expected_substring)" | tee -a $RESULTS_FILE
        ((TESTS_FAILED++))
        return 1
    fi
}

# Basic connectivity tests
echo "=== Basic Connectivity Tests ===" | tee -a $RESULTS_FILE
run_test "Homepage accessibility" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN" "200"
run_test "HTTP to HTTPS redirect" "curl -s -o /dev/null -w '%{http_code}' http://hfu-amplify.org" "301"

# NextAuth endpoint tests
echo -e "\n=== NextAuth Endpoint Tests ===" | tee -a $RESULTS_FILE
run_test "NextAuth providers endpoint" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/auth/providers" "200"
run_test "NextAuth CSRF endpoint" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/auth/csrf" "200"
run_test "NextAuth session endpoint" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/auth/session" "200"

# Provider configuration test
echo -e "\n=== Provider Configuration Test ===" | tee -a $RESULTS_FILE
run_test_contains "Cognito provider configured" "curl -s $DOMAIN/api/auth/providers | jq -r '.cognito.id'" "cognito"

# Session tests
echo -e "\n=== Session Tests ===" | tee -a $RESULTS_FILE
run_test "Session endpoint (unauthenticated)" "curl -s $DOMAIN/api/auth/session | jq -r '.user // empty' | wc -c" "0"

# Header forwarding tests
echo -e "\n=== Header Forwarding Tests ===" | tee -a $RESULTS_FILE
echo "Testing header forwarding through ALB..." | tee -a $RESULTS_FILE

# Create a test endpoint that echoes headers
HEADER_TEST=$(curl -s -H "X-Forwarded-Proto: https" -H "X-Forwarded-Host: hfu-amplify.org" -H "X-Test-Header: test-value" "$DOMAIN/api/auth/providers" -o /dev/null -w '%{http_code}')
if [ "$HEADER_TEST" = "200" ]; then
    echo "✅ Headers properly forwarded through ALB" | tee -a $RESULTS_FILE
    ((TESTS_PASSED++))
else
    echo "❌ Header forwarding issue detected" | tee -a $RESULTS_FILE
    ((TESTS_FAILED++))
fi

# Redirect chain test
echo -e "\n=== Redirect Chain Test ===" | tee -a $RESULTS_FILE
echo "Testing authentication redirect chain..." | tee -a $RESULTS_FILE

# Count redirects in signin flow
REDIRECT_COUNT=$(curl -s -I -L --max-redirs 10 "$DOMAIN/api/auth/signin" 2>&1 | grep -c "Location:")
if [ "$REDIRECT_COUNT" -lt 10 ]; then
    echo "✅ Redirect count within limits: $REDIRECT_COUNT" | tee -a $RESULTS_FILE
    ((TESTS_PASSED++))
else
    echo "❌ Too many redirects detected: $REDIRECT_COUNT" | tee -a $RESULTS_FILE
    ((TESTS_FAILED++))
fi

# DNS resolution test
echo -e "\n=== DNS Resolution Test ===" | tee -a $RESULTS_FILE
DNS_RESULT=$(dig +short hfu-amplify.org | wc -l)
if [ "$DNS_RESULT" -gt 0 ]; then
    echo "✅ DNS resolution successful" | tee -a $RESULTS_FILE
    ((TESTS_PASSED++))
else
    echo "❌ DNS resolution failed" | tee -a $RESULTS_FILE
    ((TESTS_FAILED++))
fi

# SSL certificate test
echo -e "\n=== SSL Certificate Test ===" | tee -a $RESULTS_FILE
SSL_CHECK=$(echo | openssl s_client -connect hfu-amplify.org:443 -servername hfu-amplify.org 2>/dev/null | openssl x509 -noout -subject | grep -c "hfu-amplify.org")
if [ "$SSL_CHECK" -gt 0 ]; then
    echo "✅ SSL certificate valid for domain" | tee -a $RESULTS_FILE
    ((TESTS_PASSED++))
else
    echo "❌ SSL certificate issue detected" | tee -a $RESULTS_FILE
    ((TESTS_FAILED++))
fi

# Summary
echo "" | tee -a $RESULTS_FILE
echo "=== Test Summary ===" | tee -a $RESULTS_FILE
echo "Tests Passed: $TESTS_PASSED" | tee -a $RESULTS_FILE
echo "Tests Failed: $TESTS_FAILED" | tee -a $RESULTS_FILE
echo "Success Rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%" | tee -a $RESULTS_FILE
echo "Test completed: $(date)" | tee -a $RESULTS_FILE

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n✅ All tests passed! Authentication system is working correctly." | tee -a $RESULTS_FILE
    exit 0
else
    echo -e "\n❌ Some tests failed! Please review the results above." | tee -a $RESULTS_FILE
    exit 1
fi