#!/bin/bash

# Ensure a case is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <case_number>"
  echo "Case 1: Run tests directly in the 'tests' folder"
  echo "Case 2: Run tests in the 'AmplifyHelperTests' folder"
  echo "Case 3: Run tests in the 'CustomInstructionsTests' folder"
  exit 1
fi

# Navigate to the project directory
cd tests || { echo "Directory not found"; exit 1; }

# Determine which tests to run based on the case
# ./test_all_files.sh 1    # Run everything in the 'test' folder
# ./test_all_files.sh 2    # Run everything in the 'AmplifyHelperTests' folder
# ./test_all_files.sh 3    # Run everything in the 'CustomInstructionsTests' folder
case $1 in
  1)
    echo "Running tests directly in the 'tests' folder..."
    python3 -m unittest discover -s . -p "Test*.py" -t .
    ;;
  2)
    echo "Running tests in the 'AmplifyHelperTests' folder..."
    cd AmplifyHelperTests
    python3 -m unittest discover -s . -p "Test*.py" -t .
    ;;
  3)
    echo "Running tests in the 'CustomInstructionsTests' folder..."
    cd CustomInstructionsTests
    python3 -m unittest discover -s . -p "Test*.py" -t .
    ;;
  *)
    echo "Invalid case number. Please enter 1, 2, or 3."
    exit 1
    ;;
esac