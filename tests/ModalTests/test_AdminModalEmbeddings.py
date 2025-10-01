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
from selenium.webdriver.support.ui import Select


class AccountModalTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    
    # ----------------- Setup Test Data ------------------
    def settings_admin_interface(self):

        time.sleep(5)

        user_menu = self.wait.until(EC.presence_of_element_located((By.ID, "userMenu")))
        self.assertTrue(user_menu, "User Menu button is present")
        user_menu.click()
        time.sleep(3)

        settings_select = self.wait.until(EC.presence_of_element_located((By.ID, "adminInterface")))
        self.assertTrue(settings_select, "The Admin button should be present")
        settings_select.click()
        time.sleep(7)
        
        admin_tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(admin_tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Embeddings"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Embeddings' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)
    
    # ----------------- Test Embeddings -----------------
    def test_presence_of_embeddings(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        retrieve_embeddings_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "retrieveEmbeddingsButton"))
        )
        self.assertIsNotNone(retrieve_embeddings_button, "Retrieve Embeddings button can be clicked")
        
    
    
if __name__ == "__main__":
    unittest.main(verbosity=2)