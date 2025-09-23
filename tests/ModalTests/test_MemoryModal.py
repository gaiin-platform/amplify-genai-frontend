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


class MemoryModalTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=False)
        
    # ----------------- Setup Test Data ------------------

    def settings_settings(self):

        time.sleep(5)

        user_menu = self.wait.until(EC.presence_of_element_located((By.ID, "userMenu")))
        self.assertTrue(user_menu, "User Menu button is present")
        user_menu.click()
        time.sleep(3)

        settings_select = self.wait.until(EC.presence_of_element_located((By.ID, "settingsInterface")))
        self.assertTrue(settings_select, "The Settings button should be present")
        settings_select.click()
        time.sleep(7)

        settings_modal_element = self.wait.until(EC.presence_of_element_located((By.ID, "modalTitle")))
        self.assertTrue(settings_modal_element.is_displayed(), "Settings window element is visible")
        modal_text = settings_modal_element.text
        self.assertEqual(modal_text, "Settings", "Modal title should be 'Settings'")
        time.sleep(2)
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in tabs if tab.text == "Configurations"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Configurations' tab should be present")
        admin_supported_models_tab.click()
        time.sleep(5)
        
        
    # ----------------- Test Settings Features -----------------
    def test_settings_features(self):
        
        self.settings_settings()
        
        includeMemory_check = self.wait.until(EC.presence_of_element_located((By.ID, "featureOptionFlags-includeMemory")))
        is_checked = includeMemory_check.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(3)
        
        clicked = False
        
        if not is_checked:
            includeMemory_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeMemory']")))
            includeMemory_check.click()
            clicked = True
            
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        if clicked:
            confirmation_buttons[-1].click()
        else:
            confirmation_buttons[0].click()
        
        time.sleep(5) # Wait for the load
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")
        settings_tab.click()
        
        time.sleep(3)

        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'",)
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Memory":
                    target_button = button
                    break
            except:
                continue

        self.assertIsNotNone(target_button, "The 'Memory' button should be present")
        target_button.click()
        
        time.sleep(3)
        
        memory_modal_title = self.wait.until(EC.presence_of_element_located((By.ID, "modalTitle")))
        self.assertIsNotNone(memory_modal_title, "Memory modal title should appear after selection")
        modal_text = memory_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Memory Management", "Modal title should be 'Memory Management'")
        
        time.sleep(2)
        
        close_button = self.wait.until(EC.presence_of_element_located((By.ID, "confirmationButton")))
        self.assertIsNotNone(close_button, "Close button should appear after selection")
        close_button.click()
        
        time.sleep(2)
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        settings_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", settings_scroll_window)
        
        time.sleep(1)
        
        includeMemory_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeMemory']")))
        includeMemory_check.click()
        
        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")
        settings_tab.click()

        button_present = False
        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'",)
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Memory":
                    button_present = True
                    target_button = button
                    break
            except:
                continue

        self.assertFalse(button_present, "The 'Memory' tab button should not be present")

if __name__ == "__main__":
    unittest.main(verbosity=2)
