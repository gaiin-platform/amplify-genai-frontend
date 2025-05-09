# Amplify Automated Testing

## Overview

This documentation provides instructions for running frontend automated tests on the Amplify application using Selenium. It outlines the installation process, test execution methods, and available test categories.

## Prerequisites

Ensure you have Python installed on your system. You can verify this by running:

```plaintext
python --version
```

or

```plaintext
python3 --version
```

## Installing Selenium

To install Selenium, use the following command:

```plaintext
pip install selenium
```

or, if using Python 3:

```plaintext
pip3 install selenium
```

Furthermore, to ensure the tests take in modification from the .env.local file that will be made in the following
step, it is important to install python-dotenv

```plaintext
pip install python-dotenv
```

or, if using Python 3:

```plaintext
pip3 install python-dotenv
```

## Modifying the .env

To run Selenium tests, you must modify the .env file that you created to include your credentials.

Navigate to your locally created .env file, and add the following variables to the file:

```plaintext
SELENIUM_USERNAME=<Your Username>
SELENIUM_PASSWORD=<Your Password>
```

Where it says "Your Username" and "Your Password", fill this in with your Amplify login values.

Save the modifications to the .env file

Tip: Also ensure that the local url is also saved to the following variable:

```plaintext
NEXTAUTH_URL=http://localhost:3000
```

If this value is not set in your .env, all the tests will not be able to login and fail.

Furthermore: If your created .env file is not named ".env.local" The tests will fail because they will not
correctly identify the .env file that the tests will extract the variables from.

## Modifying the Test Files

Specifically all test files are default set to run in headless mode. This means that you will not see the
window open and run the test.

However, if you choose to visually see the test run, you can change it to non-headless mode, which will 
open a Google Chrome window and show off the test automatically testing and clicking buttons.

To do this, all you need to do is specifically go to a test and in the setup header change the headless variable
to 'False'

```plaintext
# ----------------- Setup -----------------
def setUp(self, headless=False):
```

## Running the Tests

### Navigating to the Test Directory

Clone or download the Amplify frontend repository from GitHub.

After you have succesfully downloaded the Amplify frontend and created for .env.local file, 
follow the install instructions in the Amplify README.md

```plaintext
npm i
```
and then

```plaintext
npm run dev
```

You need to be able to run Amplify locally to be able to run the tests.

In another terminal window, navigate to the frontend directory:

```plaintext
cd amplify-genai-frontend-main
```

Change into the tests directory:

```plaintext
cd tests
```

### Running Individual Tests

To run a specific test file, use pytest:

```plaintext
pytest <filename>
```

For example, to run TestActiveAssistantsList.py:

```plaintext
pytest TestActiveAssistantsList.py
```

This will execute all tests defined in the file.

Furthermore, be sure you're calling pytest from in the correct directory.

The previous file for example has the path: tests/AmplifyHelperTests/TestActiveAssistantsList.py

### Running Multiple Tests

To execute multiple test files, navigate back to the main project directory:

```plaintext
cd ..
```

Then, use the provided script test_all_files.sh to run specific test groups:

```plaintext
./test_all_files.sh <option>
```

Where <option> determines which tests to execute:

1 – Run all test files in the tests folder.

2 – Run all test files in the AmplifyHelperTests folder.

3 – Run all test files in the ChatTests folder.

4 – Run all test files in the ConversationTests folder.

5 – Run all test files in the CustomInstructionsTests folder.

6 – Run all test files in the LeftSidebarTests folder.

7 – Run all test files in the ModalTests folder.

8 – Run all test files in the RightSidebarTests folder.

9 – Run all test files in the TabTests folder.

### Running Tests Asynchronously

To run all of the tests asynchronously, run the following command:

```
pytest -xvs -n auto tests/
```

## Test Organization

The tests folder contains various test files. Additionally, there are subdirectories with specialized test cases:

AmplifyHelperTests/ – Contains tests related to Amplify helper functions.

CustomInstructionsTests/ – Includes tests for Custom Instruction handling.

## Additional Notes

Ensure all required dependencies are installed before running tests.

If using a virtual environment, activate it before executing test commands.

If tests require browser automation, ensure the appropriate WebDriver is installed and configured.

For any issues, refer to the project documentation or contact the development team.

