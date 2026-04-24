#!/bin/bash
# Runs inside LocalStack on startup — creates the test bucket
set -e
echo "Creating S3 bucket: pulse-resumes-local"
awslocal s3 mb s3://pulse-resumes-local
echo "Bucket ready"
