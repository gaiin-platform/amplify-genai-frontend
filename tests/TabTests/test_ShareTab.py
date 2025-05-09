import unittest
import time
import os
from dotenv import load_dotenv
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


class ShareTabTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Test Share with other users button -----------------
    """Test the 'Share with Other Users' button in the Share tab on the 
       Left Side Bar to ensure that the share modal appears"""

    def test_share_tab_button(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Share tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Share"
        share_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Share"), None
        )
        self.assertIsNotNone(share_tab, "The 'Share' tab should be present")

        # Click the 'Share' tab
        share_tab.click()

        time.sleep(2)

        # id="shareWithOtherUsers"
        # Click the Share Button
        share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "shareWithOtherUsers"))
        )
        self.assertTrue(share_button, "Share Button should be initialized")
        share_button.click()

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Add People to Share With",
            "Modal title should be 'Add People to Share With'",
        )

    # ----------------- Test Refresh Button -----------------
    """Test the 'Refresh' button in the Share tab on the Left Side Bar
       to ensure the 'Shared with you' results refresh"""

    def test_share_tab_refresh(self):
        # Extra sleep for extra loading
        time.sleep(5)

        # Find the Share tab
        tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )
        self.assertGreater(
            len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'"
        )

        # Find the tab with title="Share"
        share_tab = next(
            (tab for tab in tabs if tab.get_attribute("title") == "Share"), None
        )
        self.assertIsNotNone(share_tab, "The 'Share' tab should be present")

        # Click the 'Share' tab
        share_tab.click()

        time.sleep(2)

        # id="refreshButton"
        # Click the Refresh Button
        refresh_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "refreshButton"))
        )
        self.assertTrue(refresh_button, "Refresh Button should be initialized")


if __name__ == "__main__":
    unittest.main(verbosity=2)
