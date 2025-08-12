import unittest
import time
import os
import re
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



class AdminConfigurationsModalTests(BaseTest):

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
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Configurations"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Configurations' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)

    # ----------------- Test Configurations Fields----------------- 
    def test_manage_account_features(self):
        
        self.settings_admin_interface()
        
        time.sleep(10) # Manage Accounts maximum load time
        
        # Click expand Component id="expandComponent"
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[0].click() # Click the first one "Add Admins"
        
        time.sleep(2)
        
        # Enter and confirm id="emailInput" exists
        email_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "emailInput"))
        )
        email_input_field.clear()
        email_input_field.send_keys("TheRealHollowKnight@email.com")
        
        time.sleep(2)
        
        add_admin_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addUserButton"))
        )
        self.assertIsNotNone(add_admin_button, "Add Admin Button button can be clicked")
        
        # Click the remove button, confirm the selectCheckAll and confirm, then click cancel
        remove_admin_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "removeAdminButton"))
        )
        self.assertIsNotNone(remove_admin_button, "Remove Admin Button button can be clicked")
        remove_admin_button.click()
        
        time.sleep(2)
        
        select_all_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAlladmins")) # Might need to change to for junk or presence
        )
        self.assertIsNotNone(select_all_check, "Select All Checkbox can be clicked")
        
        confirm_action_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "confirmAction"))
        )
        self.assertIsNotNone(confirm_action_button, "Confirm Action Admin Add Button can be clicked")
        
        time.sleep(2)
        
        cancel_action_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancelAction"))
        )
        self.assertIsNotNone(cancel_action_button, "Cancel Action Admin Add Button can be clicked")
        cancel_action_button.click()
        
        time.sleep(2)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[0].click() # Close the "Add Admins"
        
        time.sleep(2)
        
        # Hover the names and see that the delete button is present
        email_name = self.wait.until(
            EC.presence_of_element_located((By.ID, "adminEmail0"))
        )
        self.assertIsNotNone(email_name, "Email name is visible")
        
        action = ActionChains(self.driver)
        action.move_to_element(email_name).perform()

        # Locate and click the "Delete Admin" button
        delete_admin_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "deleteAdminUser"))
        )
        self.assertIsNotNone(
            delete_admin_button, "Delete Admin button should be initialized"
        )
        
        time.sleep(2)
        
        # Check that the support email is checked and that the value in email is correct
        support_email_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "supportEmail"))
        )
        self.assertIsNotNone(support_email_check, "Support Email Checkbox is visible")
        
        # Verify if the checkbox is checked, this may or may not work
        is_checked = support_email_check.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(1)
        
        email_value = self.wait.until(
            EC.presence_of_element_located((By.ID, "emailSupport-email"))
        )
        self.assertEqual(email_value.get_attribute("value"), "amplify@vanderbilt.edu", "Email value should match expected")
        
        rate_limit_select_elem = self.wait.until(EC.presence_of_element_located((By.ID, "rateLimitType")))
        self.assertIsNotNone(rate_limit_select_elem, "Rate Limit Selection Menu is visible")
        
        # Default User Conversation Storage Local selected and Cloud is not selected
        conversation_storage_checks = self.wait.until(EC.presence_of_all_elements_located((By.ID, "conversationStorageCheck")))
        self.assertIsNotNone(conversation_storage_checks, "Conversation Storage checks are visible should be present")
        
        # Verify if the checkbox is checked
        is_checked = conversation_storage_checks[0].get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")
        
        is_checked = conversation_storage_checks[1].get_attribute("checked") is not None
        self.assertFalse(is_checked, "Checkbox should be checked")
        
        time.sleep(1)
        
        scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", scroll_window)
        
        time.sleep(2)
        
        prompt_cost_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptCostAlert"))
        )
        self.assertIsNotNone(prompt_cost_check, "Prompt Cost Alert Checkbox can be clicked")
        
        time.sleep(1)
        
        add_amplify_group_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAmplifyGroup"))
        )
        self.assertIsNotNone(add_amplify_group_button, "Add Amplify Group Button can be clicked")
        add_amplify_group_button.click()
        
        time.sleep(2)
        
        # Enter and confirm id="groupName" exists
        group_name_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "groupName"))
        )
        group_name_field.clear()
        group_name_field.send_keys("The Court of the Pale King")
        
        time.sleep(2)
        
        # Enter and confirm id="emailInput" exists
        email_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "emailInput"))
        )
        email_input_field.clear()
        email_input_field.send_keys("TheRealHollowKnight@email.com")
        
        time.sleep(2)
        
        confirm_action_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "confirmAction"))
        )
        self.assertIsNotNone(confirm_action_button, "Confirm Action Admin Add Button can be clicked")
        
        time.sleep(2)
        
        cancel_action_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancelAction"))
        )
        self.assertIsNotNone(cancel_action_button, "Cancel Action Admin Add Button can be clicked")
        cancel_action_button.click()
        
        time.sleep(2)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[-1].click() # Close the "Manage Amplify Groups"
        
        time.sleep(2)
        
    # ----------------- Test Configurations Search Amplify Groups----------------- 
    def test_search_group(self):
        
        self.settings_admin_interface()
        
        time.sleep(10) # Manage Accounts maximum load time
    
        scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", scroll_window)
        
        time.sleep(2)
        
        group_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "groupTable"))
        )
        self.assertIsNotNone(group_table, "The group table is visible")
        
        group_name_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Group Name"))
        )
        self.assertIsNotNone(group_name_table, "Group Name title in table is visible")
        
        members_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Members"))
        )
        self.assertIsNotNone(members_table, "Members title in table is visible")
        
        membership_by_group_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Membership by Amplify Groups"))
        )
        self.assertIsNotNone(membership_by_group_table, "Membership by Amplify Groups title in table is visible")
        
        created_by_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Created By"))
        )
        self.assertIsNotNone(created_by_table, "Created By title in table is visible")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ['Admins', 'Amplify_Dev_SoN', 'Amplify_Dev_Students', 'Amplify_Dev', 'api_test']  # Update with your actual expected names

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
        time.sleep(2)
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("api_test")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ["api_test"]  # Update with your actual expected names

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Admins")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ["Admins"]  # Update with your actual expected names

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
    # ----------------- Test Configurations Search No Amplify Groups----------------- 
    def test_search_no_group(self):
        
        self.settings_admin_interface()
        
        time.sleep(10) # Manage Accounts maximum load time
    
        scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", scroll_window)
        
        time.sleep(2)
        
        group_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "groupTable"))
        )
        self.assertIsNotNone(group_table, "The group table is visible")
        
        group_name_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Group Name"))
        )
        self.assertIsNotNone(group_name_table, "Group Name title in table is visible")
        
        members_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Members"))
        )
        self.assertIsNotNone(members_table, "Members title in table is visible")
        
        membership_by_group_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Membership by Amplify Groups"))
        )
        self.assertIsNotNone(membership_by_group_table, "Membership by Amplify Groups title in table is visible")
        
        created_by_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "Created By"))
        )
        self.assertIsNotNone(created_by_table, "Created By title in table is visible")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'groupName'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "groupName"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ['Admins', 'Amplify_Dev_SoN', 'Amplify_Dev_Students', 'Amplify_Dev', 'api_test']  # Update with your actual expected names

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
        time.sleep(2)
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("bimbus")
        
        time.sleep(2)
        
        # Attempt to locate elements with id='groupName'
        group_name_elements = self.driver.find_elements(By.ID, "groupName")

        # Assert that the list is empty
        self.assertEqual(len(group_name_elements), 0, "No groupName elements should be present")
        
    # ----------------- Test Prompt Cost Alert ----------------- 
    def test_prompt_cost_alert(self):
        
        self.settings_admin_interface()
        
        time.sleep(10) # Manage Accounts maximum load time
        
        scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script(
            "arguments[0].scrollTop = (arguments[0].scrollHeight - arguments[0].clientHeight) / 2;",
            scroll_window
        )
        
        time.sleep(2)
        
        prompt_cost_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='promptCostAlert']")))
        prompt_cost_check.click()
        
        time.sleep(2)
        
        # id="costThresholdInput"
        cost_threshold_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "costThresholdInput"))
        )
        cost_threshold_input.clear()
        cost_threshold_input.send_keys("5.1")
        
        time.sleep(2)
        
        prompt_cost_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='promptCostAlert']")))
        prompt_cost_check.click()
        
        time.sleep(2)
        
        # Locate and click the Cancel button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Confirmation Button elements should be initialized")
        
        cancel_button = next((el for el in confirmation_button if el.text == "Close"), None)
        self.assertIsNotNone(cancel_button, "Close button should be present")
        
        cancel_button.click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(3)
        
    # ----------------- Test Add Empty Email Name  ----------------- 
    def test_add_empty_email(self):
        
        self.settings_admin_interface()
        
        time.sleep(10) # Manage Accounts maximum load time
        
        # Get the admin ids up till whatever index it reaches (it should be 4, but I want to make the test dynamic)
        # Get the highest admin index before the test
        admin_elements = self.driver.find_elements(By.CSS_SELECTOR, "[id^='adminEmail']")
        max_index_before = max(
            [int(re.search(r'adminEmail(\d+)', elem.get_attribute('id')).group(1)) 
            for elem in admin_elements 
            if re.search(r'adminEmail(\d+)', elem.get_attribute('id'))], 
            default=-1
        )

        print(f"Max admin index before add attempt: {max_index_before}")
        
        # Click expand Component id="expandComponent"
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[0].click() # Click the first one "Add Admins"
        
        time.sleep(2)
        
        # Enter and confirm id="emailInput" exists
        email_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "emailInput"))
        )
        email_input_field.clear()
        
        add_admin_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addUserButton"))
        )
        self.assertIsNotNone(add_admin_button, "Add Admin Button button can be clicked")
        add_admin_button.click()
        
        # Get the admin ids up till whatever index it reaches (it should STILL be 4, but I want to make the test dynamic)
        
        # Get the highest admin index after the add attempt
        admin_elements_after = self.driver.find_elements(By.CSS_SELECTOR, "[id^='adminEmail']")
        max_index_after = max(
            [int(re.search(r'adminEmail(\d+)', elem.get_attribute('id')).group(1)) 
            for elem in admin_elements_after 
            if re.search(r'adminEmail(\d+)', elem.get_attribute('id'))], 
            default=-1
        )

        print(f"Max admin index after add attempt: {max_index_after}")

        # Assert that no new admin was added
        self.assertEqual(max_index_before, max_index_after, "No admin should be added when email input is empty")
    

if __name__ == "__main__":
    unittest.main(verbosity=2)