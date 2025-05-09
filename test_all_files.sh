#!/bin/bash

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Ensure a case is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <case_number>"
  echo "Case 1: Run everything in the 'test' folder (Run all the folders, with all tests inside)"
  echo "Case 2: Run everything in the 'AmplifyHelperTests' folder"
  echo "Case 3: Run everything in the 'ChatTests' folder"
  echo "Case 4: Run everything in the 'ConversationsTests' folder"
  echo "Case 5: Run everything in the 'CustomInstructionsTests' folder"
  echo "Case 6: Run everything in the 'LeftSidebarTests' folder"
  echo "Case 7: Run everything in the 'ModalTests' folder"
  echo "Case 8: Run everything in the 'RightSidebarTests' folder"
  echo "Case 9: Run everything in the 'TabTests' folder"
  exit 1
fi

# Set PYTHONPATH to include the project root
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Set the ENV_FILE environment variable
export ENV_FILE="$SCRIPT_DIR/.env.local"

# Navigate to the project directory
cd "$SCRIPT_DIR" || { echo "Directory not found"; exit 1; }

# Function to run tests in a specific directory
run_tests_in_directory() {
  local dir=$1
  echo "Running tests in the '$dir' folder..."
  
  # Find all test files, excluding .pytest_cache and __pycache__
  find "tests/$dir" -type f -name "test_*.py" | grep -v "\.pytest_cache" | grep -v "__pycache__" | while read -r test_file; do
    echo "Running tests in $test_file..."
    PYTHONPATH="$SCRIPT_DIR" python3 -m unittest -v "$test_file"
  done
}

# Determine which tests to run based on the case
case $1 in
  1)
    echo "Running all tests in all folders..."
    find tests -type f -name "test_*.py" | grep -v "\.pytest_cache" | grep -v "__pycache__" | while read -r test_file; do
      echo "Running tests in $test_file..."
      PYTHONPATH="$SCRIPT_DIR" python3 -m unittest -v "$test_file"
    done
    ;;
  2)
    run_tests_in_directory "AmplifyHelperTests"
    ;;
  3)
    run_tests_in_directory "ChatTests"
    ;;
  4)
    run_tests_in_directory "ConversationsTests"
    ;;
  5)
    run_tests_in_directory "CustomInstructionsTests"
    ;;
  6)
    run_tests_in_directory "LeftSidebarTests"
    ;;
  7)
    run_tests_in_directory "ModalTests"
    ;;
  8)
    run_tests_in_directory "RightSidebarTests"
    ;;
  9)
    run_tests_in_directory "TabTests"
    ;;
  *)
    echo "Invalid case number. Please enter a number between 1 and 9."
    exit 1
    ;;
esac