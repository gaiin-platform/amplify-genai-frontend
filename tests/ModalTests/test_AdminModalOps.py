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
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Ops"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Ops' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)
    
    # ----------------- Test Ops -----------------
    def test_register_ops(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        add_op_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "addOp"))
        )
        self.assertIsNotNone(add_op_button, "Add Endpoint Button can be clicked")
        add_op_button.click()
        
        time.sleep(3)
        
        op_tags = self.wait.until(
            EC.presence_of_element_located((By.ID, "OPS0-tags"))
        )
        op_tags.clear()
        op_tags.send_keys("Mark")
        
        time.sleep(3)
        
        op_tags = self.wait.until(
            EC.presence_of_element_located((By.ID, "OPS0-name"))
        )
        op_tags.clear()
        op_tags.send_keys("Dark Mark")
        
        time.sleep(3)
        
        op_tags = self.wait.until(
            EC.presence_of_element_located((By.ID, "OPS0-url"))
        )
        op_tags.clear()
        op_tags.send_keys("MarkyMark.com")
        
        time.sleep(3)
        
        op_tags = self.wait.until(
            EC.presence_of_element_located((By.ID, "OPS0-description"))
        )
        op_tags.clear()
        op_tags.send_keys("An Invincible hero")
        
        time.sleep(3)
        
        select_request_type_elem = self.wait.until(EC.presence_of_element_located((By.ID, "selectRequestType")))
        self.assertIsNotNone(select_request_type_elem, "Select Request Type Selection Menu is visible")
        
        add_op_parameter_elem = self.wait.until(EC.presence_of_element_located((By.ID, "addOpParameter")))
        self.assertIsNotNone(add_op_parameter_elem, "Add Op Parameter Button is visible")
        
        register_op = self.wait.until(EC.presence_of_element_located((By.ID, "registerOps")))
        self.assertIsNotNone(register_op, "Register Op Button is visible")
        
    # ----------------- Test Manage Ops Search Name -----------------
    def test_manage_ops_search_name(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[0].click() # Close the "Understanding Ops"
        
        time.sleep(3)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names. Temporarily Description is out??
        expected_group_names = ["Function Name", "Tags", "Path", "Method", "Parameters", ""]
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(2)
        
        # id="nameTagToggle"
        name_tag_toggle = self.wait.until(EC.presence_of_all_elements_located((By.ID, "nameTagToggle")))
        self.assertIsNotNone(name_tag_toggle, "Name Tag Toggle Buttons are visible should be present")
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("addattachment")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'functionName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "functionName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names
        expected_group_names = ['addAttachment', 'calendarAddAttachment', 'microsoftaddAttachment', 'microsoftAddAttachment', 'microsoftcalendarAddAttachment', 'microsoftCalendarAddAttachment']
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(3)
        
        # Search in the Search Bar for Nothing
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Guts")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'functionName'
        search_results = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "functionName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

    # ----------------- Test Manage Ops Search Tags -----------------
    def test_manage_ops_search_tags(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[0].click() # Close the "Understanding Ops"
        
        time.sleep(3)
        
        # id="nameTagToggle"
        name_tag_toggle = self.wait.until(EC.presence_of_all_elements_located((By.ID, "nameTagToggle")))
        self.assertIsNotNone(name_tag_toggle, "Name Tag Toggle Buttons are visible should be present")
        name_tag_toggle[-1].click()
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("google_docs")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'functionName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "functionName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names
        expected_group_names = ['appendText', 'createDocumentOutline', 'createNewDocument', 'exportDocument', 'findTextIndices', 'getDocumentContents', 'googleappendText', 'googleAppendText', 'googlecreateDocumentOutline', 'googleCreateDocumentOutline', 'googlecreateNewDocument', 'googleCreateNewDocument', 'googleexportDocument', 'googleExportDocument', 'googlefindTextIndices', 'googleFindTextIndices', 'googlegetDocumentContents', 'googleGetDocumentContents', 'googleinsertText', 'googleInsertText', 'googlereplaceText', 'googleReplaceText', 'googleshareDocument', 'googleShareDocument', 'insertText']
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(3)
        
        # Search in the Search Bar for Nothing
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Intimidate")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'functionName'
        search_results = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "functionName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

    
if __name__ == "__main__":
    unittest.main(verbosity=2)