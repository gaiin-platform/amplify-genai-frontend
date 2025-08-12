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
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Feature Flags"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Feature Flags' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)

    # ----------------- Test Adding Feature Flags -----------------
    def test_add_feature_flags(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        add_feature_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addFeatureButton"))
        )
        self.assertIsNotNone(add_feature_button, "Add Feature Button can be clicked")
        add_feature_button.click()
        
        time.sleep(2)
        
        feature_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "featureNameInput"))
        )
        feature_name_input.clear()
        feature_name_input.send_keys("Yuji Itadori")
        
        time.sleep(2)
        
        status_toggle = self.wait.until(
            EC.presence_of_element_located((By.ID, "statusToggle"))
        )
        self.assertIsNotNone(status_toggle, "Status Toggle Button is present")
        
        feature_email_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "emailInput"))
        )
        feature_email_input.clear()
        feature_email_input.send_keys("sukuna_finger_eater@email.com")
        
        time.sleep(2)
        
        add_user_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "addUserButton"))
        )
        self.assertIsNotNone(add_user_button, "Add User Button is present")
        
        confirm_action_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "confirmAction"))
        )
        self.assertIsNotNone(confirm_action_button, "Confirm Action Admin Add Button can be clicked")
        
        cancel_action_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancelAction"))
        )
        self.assertIsNotNone(cancel_action_button, "Cancel Action Admin Add Button can be clicked")
        cancel_action_button.click()
        
        time.sleep(2)
        
    id="featureFlagsTable"
        
    # ----------------- Test Feature Flags Table Headers Present -----------------
    def test_feature_flags_table(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        feature_flags_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "featureFlagsTable"))
        )
        self.assertIsNotNone(feature_flags_table, "The feature flags table is visible")
        
        feature_flags_feature = self.wait.until(
            EC.presence_of_element_located((By.ID, "Feature"))
        )
        self.assertIsNotNone(feature_flags_feature, "Feature Flag Feature title in table is visible")
        
        feature_flags_status = self.wait.until(
            EC.presence_of_element_located((By.ID, "Status"))
        )
        self.assertIsNotNone(feature_flags_status, "Feature Flag Status title in table is visible")
        
        feature_flags_user_exception = self.wait.until(
            EC.presence_of_element_located((By.ID, "User Exceptions"))
        )
        self.assertIsNotNone(feature_flags_user_exception, "Feature Flag User Exceptions title in table is visible")
        
        feature_flags_exception_membership = self.wait.until(
            EC.presence_of_element_located((By.ID, "User Exceptions by Amplify Group Membership"))
        )
        self.assertIsNotNone(feature_flags_exception_membership, "Feature Flag User Exceptions by Amplify Group Membership title in table is visible")
        
    # ----------------- Test Feature Flags Search Bar -----------------
    def test_search_feature_flags(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        # Wait for all matching elements with ID 'featureTitleName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "featureTitleName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names
        expected_group_names = ['Action Sets', 'Agent Assistant Type', 'Agent Tools', 'Api Keys', 'Artifacts', 'Assistant Admin Interface', 'Assistant Apis', 'Assistant Email Events', 'Assistant Path Publishing', 'Assistant Workflows', 'Automation', 'Cached Documents', 'Code Interpreter Enabled', 'Create Assistant Workflows', 'Create Ast Admin Groups', 'Create Python Function Apis', 'Data Disclosure', 'Data Source Selector On Input', 'Follow Up Create', 'Highlighter', 'Integrations', 'Market', 'Memory', 'Mix Panel', 'Mtd Cost', 'Output Transformer Create', 'Override Invisible Prompts', 'Plugins On Input', 'Prompt Optimizer', 'Prompt Prefix Create', 'Publicize Python Function Apis', 'Python Function Apis', 'Rag Enabled', 'Root Prompt Create', 'Scheduled Tasks', 'Store Cloud Conversations', 'Upload Documents', 'Website Urls', 'Workflow Create']
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(2)
        
        # Individual Search
        
        # Search in the Search Bar for specifc features
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("tools")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'featureTitleName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "featureTitleName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]

        # Expected feature names
        expected_feature_names = ['Agent Tools']  # Update with your actual expected names

        # Assert that the feature_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_feature_names),
            f"Expected feature names {expected_feature_names}, but got {feature_names}"
        )
        
        # Multiple Search
        
        # Search in the Search Bar for specifc features
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("admin")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'featureTitleName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "featureTitleName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]

        # Expected feature names
        expected_feature_names = ['Assistant Admin Interface', 'Create Ast Admin Groups']  # Update with your actual expected names

        # Assert that the feature_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_feature_names),
            f"Expected feature names {expected_feature_names}, but got {feature_names}"
        )
        

if __name__ == "__main__":
    unittest.main(verbosity=2)