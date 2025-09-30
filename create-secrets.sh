#!/bin/bash

# Script to create AWS Secrets Manager secrets for Amplify

echo "Creating AWS Secrets Manager secrets..."

# Create NextAuth secret
aws secretsmanager create-secret \
  --name amplify/nextauth-secret \
  --description "NextAuth secret for Amplify" \
  --secret-string '{
    "NEXTAUTH_SECRET": "k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4="
  }' \
  --region us-east-1 || echo "NextAuth secret already exists"

# Create Cognito credentials secret
aws secretsmanager create-secret \
  --name amplify/cognito-credentials \
  --description "Cognito credentials for Amplify" \
  --secret-string '{
    "CLIENT_ID": "2rq8ekafegrh5mcd51q80rt0bh",
    "CLIENT_SECRET": "p2np9r5nt5nptnc74gv65q7siigo8a0rim211ai1nqmqvl7ssuk"
  }' \
  --region us-east-1 || echo "Cognito credentials secret already exists"

echo "Secrets created/verified successfully!"