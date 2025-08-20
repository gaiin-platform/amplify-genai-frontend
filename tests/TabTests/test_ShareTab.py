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

    # ----------------- Test Share with other users modal visible -----------------
    """Test the visibility of the Sharing Center modal"""

    def test_share_modal(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "Logout Button should be initialized")

        user_menu_button.click()

        time.sleep(2)

        # Click the Share Button
        share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sharingCenter"))
        )
        self.assertTrue(share_button, "Share Button should be initialized")
        share_button.click()
        
        time.sleep(3)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "sharingCenterModalTitle"))
        )
        self.assertTrue(
            share_modal_element, "Share window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Sharing Center",
            "Modal title should be 'Sharing Center'",
        )

    # ----------------- Test Refresh Button -----------------
    """Test the 'Refresh' button in the Share tab on the Left Side Bar
       to ensure the 'Shared with you' results refresh"""

    def test_share_refresh(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "Logout Button should be initialized")

        user_menu_button.click()

        time.sleep(2)

        # Click the Share Button
        share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sharingCenter"))
        )
        self.assertTrue(share_button, "Share Button should be initialized")
        share_button.click()
        
        time.sleep(3)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "sharingCenterModalTitle"))
        )
        self.assertTrue(
            share_modal_element, "Share window element is visible"
        )

        time.sleep(3)

        # Click the Refresh Button
        refresh_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "refreshButton"))
        )
        self.assertTrue(refresh_button, "Refresh Button should be initialized")
        refresh_button.click()
        
        time.sleep(5)
        
    # ----------------- Test Share with other users button -----------------
    """Test the 'Share with Other' button in the Share modal"""

    def test_share_button(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "Logout Button should be initialized")

        user_menu_button.click()

        time.sleep(2)

        # Click the Share Button
        share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sharingCenter"))
        )
        self.assertTrue(share_button, "Share Button should be initialized")
        share_button.click()
        
        time.sleep(3)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "sharingCenterModalTitle"))
        )
        self.assertTrue(
            share_modal_element, "Share window element is visible"
        )

        time.sleep(3)
        
        # Click the Share Button
        share_with_others_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "shareWithOtherUsers"))
        )
        self.assertTrue(share_with_others_button, "Share Button should be initialized")
        share_with_others_button.click()
        
        time.sleep(3)
        
        # Verify the presence of ALL modalTitle elements after clicking the Edit button
        modal_title_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            modal_title_elements, "No modalTitle elements were found"
        )

        time.sleep(3)

        # Extract all texts (strip whitespace just in case)
        modal_texts = [el.text.strip() for el in modal_title_elements]

        print("Extracted modal titles:", modal_texts)  # Debugging output

        # Ensure at least one matches the expected value
        self.assertIn(
            "Add People to Share With",
            modal_texts,
            f"Expected 'Add People to Share With' in modal titles, but got {modal_texts}",
        )
        
        


if __name__ == "__main__":
    unittest.main(verbosity=2)
