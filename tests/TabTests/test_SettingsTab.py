import unittest
import time
import os
from dotenv import load_dotenv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    UnexpectedAlertPresentException,
    NoSuchElementException,
)
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest


class SettingsTabTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Test Manage Accounts -----------------
    """Test the Manage Accounts button in the Settings tab on the Left Side Bar"""

    def test_settings_assistant_group_interface(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Settings tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Settings"
        settings_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Settings"), None
        )
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()

        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBarButton"))
        )
        self.assertGreater(
            len(side_bar_buttons),
            1,
            "Expected multiple buttons with ID 'sideBarButton'",
        )

        # Find the button that contains a span with text "Assistant Group Interface"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Assistant Group Interface":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(
            target_button, "The 'Assistant Group Interface' button should be present"
        )

        # Click the button
        target_button.click()
        
        time.sleep(2)

        # id="selectAssistantGroup"
        # Verify the presence of the Window element after clicking the Edit button
        account_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAssistantGroup"))
        )
        self.assertTrue(
            account_modal_element, "Account modal is visible"
        )

        time.sleep(3)

    # ----------------- Test Import Conversations -----------------
    """Test the Import Conversations button in the Settings tab on the Left Side Bar"""

    def test_settings_import_conversations(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Settings tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Settings"
        settings_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Settings"), None
        )
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()

        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBarButton"))
        )
        self.assertGreater(
            len(side_bar_buttons),
            1,
            "Expected multiple buttons with ID 'sideBarButton'",
        )

        # Find the button that contains a span with text "Import Conversations"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Import Conversations":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(
            target_button, "The 'Import Conversations' button should be present"
        )

        # Click the button
        target_button.click()

        time.sleep(2)

        # Check if the file input becomes available
        file_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "import-file"))
        )
        self.assertIsNotNone(
            file_input, "The file picker should appear for importing conversations."
        )

    # ----------------- Test Export Conversations -----------------
    """Test the Export Conversations button in the Settings tab on the Left Side Bar"""

    def test_settings_export_conversations(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Settings tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Settings"
        settings_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Settings"), None
        )
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()

        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBarButton"))
        )
        self.assertGreater(
            len(side_bar_buttons),
            1,
            "Expected multiple buttons with ID 'sideBarButton'",
        )

        # Find the button that contains a span with text "Export Conversations"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Export Conversations":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(
            target_button, "The 'Export Conversations' button should be present"
        )

        # Click the button
        target_button.click()

        time.sleep(2)

        # Define Download Path
        download_dir = os.path.expanduser(
            "~/Downloads"
        )  # Adjust if using a different directory

        # Generate the expected filename with MM-DD format
        current_date = datetime.now().strftime("%-m-%-d")  # Format MM-DD
        expected_filename = f"chatbot_ui_history_{current_date}.json"
        expected_filepath = os.path.join(download_dir, expected_filename)

        # Wait for the file to appear
        timeout = 30  # Max wait time in seconds
        start_time = time.time()

        while time.time() - start_time < timeout:
            if os.path.exists(expected_filepath):
                print(f"Download successful! File found: {expected_filepath}")
                break
            time.sleep(1)
        else:
            self.fail(
                f"Download failed: Expected file '{expected_filename}' not found in {download_dir}"
            )

        # Assert file exists
        self.assertTrue(
            os.path.exists(expected_filepath),
            f"Expected downloaded file '{expected_filename}' to exist.",
        )

    # ----------------- Test Assistant Worflow Tab -----------------
    """Test the Assistant Worflow button in the Settings tab on the Left Side Bar"""

    def test_settings_assistant_workflow(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Settings tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Settings"
        settings_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Settings"), None
        )
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()

        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBarButton"))
        )
        self.assertGreater(
            len(side_bar_buttons),
            1,
            "Expected multiple buttons with ID 'sideBarButton'",
        )

        # Find the button that contains a span with text "Settings"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Assistant Workflows":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(target_button, "The 'Assistant Workflows' button should be present")

        # Click the button
        target_button.click()
        
        time.sleep(2)

        # Verify the presence of the Window element after clicking the Edit button
        settings_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            settings_modal_element.is_displayed(), "Assistant Workflows window element is visible"
        )

        # Extract the text from the element
        modal_text = settings_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Create Assistant Workflow Template", "Modal title should be 'Create Assistant Workflow Template'")

    # ----------------- Test Manage Custom APIs -----------------
    """Test the Custom Function APIs button in the Settings tab on the Left Side Bar
       This will cause the Manage Custom APIs modal to pop up"""

    def test_settings_manage_custom_apis(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Settings tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Settings"
        settings_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Settings"), None
        )
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()

        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBarButton"))
        )
        self.assertGreater(
            len(side_bar_buttons),
            1,
            "Expected multiple buttons with ID 'sideBarButton'",
        )

        # Find the button that contains a span with text "Custom Function APIs"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Custom Function APIs":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(
            target_button, "The 'Custom Function APIs' button should be present"
        )
        
        # Click the button
        target_button.click()
        
        time.sleep(2)

        # Verify the presence of the Window element after clicking the Edit button
        settings_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "pythonFunctionModalTitle"))
        )
        self.assertTrue(
            settings_modal_element.is_displayed(), "Manage Custom APIs window element is visible"
        )

        # Extract the text from the element
        modal_text = settings_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Manage Custom APIs", "Modal title should be 'Manage Custom APIs'")
        
    # ----------------- Test Manage Scheduled Tasks -----------------
    """Test the Scheduled Tasks button in the Settings tab on the Left Side Bar
       This will cause the Manage Scheduled Tasks modal to pop up"""

    def test_settings_manage_scheduled_tasks(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Settings tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Settings"
        settings_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Settings"), None
        )
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()

        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBarButton"))
        )
        self.assertGreater(
            len(side_bar_buttons),
            1,
            "Expected multiple buttons with ID 'sideBarButton'",
        )

        # Find the button that contains a span with text "Custom Function APIs"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Scheduled Tasks":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(
            target_button, "The 'Scheduled Tasks' button should be present"
        )
        
        # Click the button
        target_button.click()
        
        time.sleep(2)

        # Verify the presence of the Window element after clicking the Edit button
        settings_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            settings_modal_element.is_displayed(), "Manage Scheduled Tasks window element is visible"
        )

        # Extract the text from the element
        modal_text = settings_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Manage Scheduled Tasks", "Modal title should be 'Manage Scheduled Tasks'")

if __name__ == "__main__":
    unittest.main(verbosity=2)
