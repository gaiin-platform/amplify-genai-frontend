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
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Feature Data"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Feature Data' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)
    
    # ----------------- Test Feature Data Upload documents and Admin Groups Check -----------------
    def test_upload_docs_and_admin_group_check(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        upload_file_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "uploadFileundefined"))
        )
        self.assertIsNotNone(upload_file_button, "Upload File Button can be clicked")
        
        expand_upload_api_docs_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "expandUploadApiDocs"))
        )
        self.assertIsNotNone(expand_upload_api_docs_button, "Expand Upload API Files Button can be clicked")
        expand_upload_api_docs_button.click()
        time.sleep(1)
        expand_upload_api_docs_button.click()
        
        upload_file_api_pdf_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "uploadFileAPI PDF"))
        )
        self.assertIsNotNone(upload_file_api_pdf_button, "Upload File API PDF Button can be clicked")
        
        upload_file_api_csv_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "uploadFileAPI CSV"))
        )
        self.assertIsNotNone(upload_file_api_csv_button, "Upload File API CSV Button can be clicked")
        
        upload_file_postman_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "uploadFilePostman Collection"))
        )
        self.assertIsNotNone(upload_file_postman_button, "Upload File Postman Collection Button can be clicked")
        
        # Wait for all elements with id="addAssistantCopy" to be present
        assistant_copy_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "addAssistantCopy"))
        )

        # Assert that there are exactly 3 elements
        self.assertEqual(len(assistant_copy_buttons), 3, "There should be exactly 3 addAssistantCopy buttons.")

    # ----------------- Test Feature Data Manage Assistant Admin Groups -----------------
    def test_manage_assistant_admin_groups(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        expand_manage_assistant_admin_groups_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "expandComponent"))
        )
        self.assertIsNotNone(expand_manage_assistant_admin_groups_button, "Expand Manage Assistant Admin Groups can be clicked")
        expand_manage_assistant_admin_groups_button.click()
        time.sleep(1)
        
        assistant_admin_table = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "assistantAdminGroupsTable"))
        )
        self.assertTrue(assistant_admin_table, "Manage Assistant Admin Groups table is not presence and deleted")
        
        expand_manage_assistant_admin_groups_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "expandComponent"))
        )
        self.assertIsNotNone(expand_manage_assistant_admin_groups_button, "Expand Manage Assistant Admin Groups can be clicked")
        expand_manage_assistant_admin_groups_button.click()
        time.sleep(1)
        
        assistant_admin_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantAdminGroupsTable"))
        )
        self.assertTrue(assistant_admin_table, "Manage Assistant Admin Groups table is not presence and deleted")
        
        time.sleep(3)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names
        expected_group_names = ['Test', 'Amplify Assistants', 'Max Test Group 2', 'New Test Group', "Max's Test Group", 'Once upon a Witchlight', 'Teams Assistant']
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(2)
        
        # Search in the Search Bar for specifc features
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Max's Test Group")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names
        expected_group_names = ["Max's Test Group"]
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(3)
        
        # Search in the Search Bar for specifc features
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Group")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        feature_names = [element.text for element in search_results]
        
        # Expected group names
        expected_group_names = ['Max Test Group 2', 'New Test Group', "Max's Test Group"]
        
        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(feature_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {feature_names}"
        )
        
        time.sleep(3)
        
        # Search in the Search Bar for specifc features
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Chocobo")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")
        
        time.sleep(3)
        
    # ----------------- Test Feature Data PowerPoints Template -----------------
    def test_powerpoint_template(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        powerpoint_template_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "powerpointTemplateTable"))
        )
        self.assertTrue(powerpoint_template_table, "Manage Assistant Admin Groups table is not presence and deleted")
        
        powerpoint_template_name = self.wait.until(
            EC.presence_of_element_located((By.ID, "Template Name"))
        )
        self.assertIsNotNone(powerpoint_template_name, "Powerpoint Template Name title in table is visible")
        
        powerpoint_template_public = self.wait.until(
            EC.presence_of_element_located((By.ID, "Public"))
        )
        self.assertIsNotNone(powerpoint_template_public, "Powerpoint Template Public title in table is visible")
        
        powerpoint_template_amplify_group_membership = self.wait.until(
            EC.presence_of_element_located((By.ID, "Available to User via Amplify Group Membership"))
        )
        self.assertIsNotNone(powerpoint_template_amplify_group_membership, "Powerpoint Template Name title in table is visible")
    
    # ----------------- Test Feature Data PowerPoints Template -----------------
    def test_add_powerpoint_template(self):
        
        self.settings_admin_interface()
        
        time.sleep(3)
        
        add_powerpoint_template_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addPowerpointTemplate"))
        )
        self.assertTrue(add_powerpoint_template_button, "Add Powerpoint template button is clickable and clicked")
        add_powerpoint_template_button.click()
        
        time.sleep(3)
        
        powerpoint_upload = self.wait.until(
            EC.presence_of_element_located((By.ID, "pptx_upload"))
        )
        self.assertTrue(powerpoint_upload, "Powerpoint Upload Button is present")
        
        powerpoint_template_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "templateNameInput"))
        )
        self.assertTrue(powerpoint_template_name_input, "Powerpoint Name Template is present")
        
        powerpoint_status_availability = self.wait.until(
            EC.presence_of_element_located((By.ID, "templateNameInput"))
        )
        self.assertTrue(powerpoint_status_availability, "Powerpoint Availability is present")


if __name__ == "__main__":
    unittest.main(verbosity=2)