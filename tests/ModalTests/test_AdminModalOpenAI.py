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
        
        time.sleep(7)
        
        admin_tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(admin_tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "OpenAi Endpoints"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'OpenAi Endpoints' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)

    # ----------------- Test OpenAI Endpoints Available -----------------
    def test_expected_endpoints(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        # Find all OpenAI Endpoint blocks
        endpoint_blocks = self.driver.find_elements(By.ID, "openAiEndpoint")

        model_names = []

        for block in endpoint_blocks:
            try:
                model_label = block.find_element(By.ID, "endpointModelName")
                model_names.append(model_label.text.strip())
            except Exception as e:
                print(f"Failed to find model name in block: {e}")
                
        print(model_names)
        
        expected_list = ['gpt-4-turbo', 'o1-preview', 'o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-35-turbo', 'text-embedding-ada-002', 'code-interpreter']
        
        self.assertEqual(model_names, expected_list, "The expected list of models equals the extracted models")
        
    # ----------------- Test OpenAI Endpoints Available -----------------
    def test_created_endpoint(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        add_endpoint_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "addEndpointButton-gpt-4-turbo"))
        )
        self.assertIsNotNone(add_endpoint_button, "Add Endpoint Button can be clicked")
        add_endpoint_button.click()
        
        time.sleep(3)
        
        url_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "openaiEndpoints-gpt-4-turbo-1-url"))
        )
        url_input.clear()
        url_input.send_keys("cuh-cuh-cuh-cuh-cuh-cuh-cuh-cuh-corykenshin")
        
        time.sleep(3)
        
        key_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "openaiEndpoints-gpt-4-turbo-1-key"))
        )
        key_input.clear()
        key_input.send_keys("monsters-we-make-vol-1")
        
        time.sleep(3)
        
        # id="urlKeyHover-gpt-4-turbo-1"
        
        url_and_key_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "urlKeyHover-gpt-4-turbo-1"))
        )
        self.assertIsNotNone(url_and_key_hover, "Hover over the created url and key inputs")
        
        time.sleep(2)
        
        action = ActionChains(self.driver)
        action.move_to_element(url_and_key_hover).perform()
        
        # Locate and click the delete created endpoint button
        delete_created_endpoint_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteCreatedEndpoint"))
        )
        self.assertIsNotNone(
            delete_created_endpoint_button, "Delete created endpoint button should be initialized and clicked"
        )
        delete_created_endpoint_button.click()
        
        time.sleep(3)
        
        created_url_and_key = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "urlKeyHover-gpt-4-turbo-1"))
        )
        self.assertTrue(created_url_and_key, "Created url and key inputs is not presence and deleted")
        
        time.sleep(3)
        
        # Locate and click the Close button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Confirmation Button elements should be initialized")
        
        close_button = next((el for el in confirmation_button if el.text == "Close"), None)
        self.assertIsNotNone(close_button, "Close button should be present")
        
        close_button.click()
        
    # ----------------- Test OpenAI Endpoints Create Multiple Endpoints in One Model -----------------
    def test_created_multiple_endpoints_one_model(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        add_endpoint_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "addEndpointButton-o1-preview"))
        )
        self.assertIsNotNone(add_endpoint_button, "Add Endpoint Button can be clicked")
        add_endpoint_button.click()
        
        time.sleep(3)
        
        add_endpoint_button.click()
        
        url_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "openaiEndpoints-o1-preview-1-url"))
        )
        url_input.clear()
        url_input.send_keys("unbreakable-strength")
        
        time.sleep(3)
        
        key_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "openaiEndpoints-o1-preview-1-key"))
        )
        key_input.clear()
        key_input.send_keys("uh-oh")
        
        time.sleep(3)
        
        url_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "openaiEndpoints-o1-preview-2-url"))
        )
        url_input.clear()
        url_input.send_keys("we-in-here")
        
        time.sleep(3)
        
        key_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "openaiEndpoints-o1-preview-2-key"))
        )
        key_input.clear()
        key_input.send_keys("monsters-we-make-vol-2")
        
        time.sleep(3)
        
        url_and_key_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "urlKeyHover-o1-preview-1"))
        )
        self.assertIsNotNone(url_and_key_hover, "Hover over the created url and key inputs")
        
        time.sleep(2)
        
        action = ActionChains(self.driver)
        action.move_to_element(url_and_key_hover).perform()
        
        # Locate and click the delete created endpoint button
        delete_created_endpoint_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteCreatedEndpoint"))
        )
        self.assertIsNotNone(
            delete_created_endpoint_button, "Delete created endpoint button should be initialized and clicked"
        )
        delete_created_endpoint_button.click()
        
        time.sleep(3)
        
        created_url_and_key = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "urlKeyHover-o1-preview-2"))
        )
        self.assertTrue(created_url_and_key, "Created url and key inputs is not presence and deleted")
        
        time.sleep(3)
        
        url_and_key_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "urlKeyHover-o1-preview-1"))
        )
        self.assertIsNotNone(url_and_key_hover, "Hover over the created url and key inputs")
        
        time.sleep(2)
        
        action = ActionChains(self.driver)
        action.move_to_element(url_and_key_hover).perform()
        
        # Locate and click the delete created endpoint button
        delete_created_endpoint_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteCreatedEndpoint"))
        )
        self.assertIsNotNone(
            delete_created_endpoint_button, "Delete created endpoint button should be initialized and clicked"
        )
        delete_created_endpoint_button.click()
        
        time.sleep(3)
        
        created_url_and_key = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "urlKeyHover-o1-preview-1"))
        )
        self.assertTrue(created_url_and_key, "Created url and key inputs is not presence and deleted")
        
        time.sleep(3)
        
        # Locate and click the Close button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Confirmation Button elements should be initialized")
        
        close_button = next((el for el in confirmation_button if el.text == "Close"), None)
        self.assertIsNotNone(close_button, "Close button should be present")
        
        close_button.click()
    

if __name__ == "__main__":
    unittest.main(verbosity=2)