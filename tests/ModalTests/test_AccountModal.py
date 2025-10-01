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
        super().setUp(headless=False)
        
    
    # ----------------- Setup Test Data ------------------
    def settings_manage_accounts(self):

        time.sleep(5)

        user_menu = self.wait.until(EC.presence_of_element_located((By.ID, "userMenu")))
        self.assertTrue(user_menu, "User Menu button is present")
        user_menu.click()
        time.sleep(3)

        settings_select = self.wait.until(EC.presence_of_element_located((By.ID, "settingsInterface")))
        self.assertTrue(settings_select, "The Settings button should be present")
        settings_select.click()
        time.sleep(7)
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in tabs if tab.text == "Accounts"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Accounts' tab should be present")
        admin_supported_models_tab.click()
        time.sleep(5)

    
    # ----------------- Test Manage Account Features in Accounts Tab -----------------
    def test_manage_account_features(self):
        
        self.settings_manage_accounts()
        
        account_name_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "accountNameInput"))
        )
        account_name_field.clear()
        time.sleep(1)
        account_name_field.send_keys("Hollow Knight")
        
        time.sleep(2)
        
        coa_string_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "coaStringInput"))
        )
        coa_string_field.clear()
        time.sleep(1)
        coa_string_field.send_keys("Chick-Fil-A Sauce")
        
        time.sleep(2)
        
        # Wait until the select element is present
        rate_limit_select_elem = self.wait.until(EC.presence_of_element_located((By.ID, "rateLimitType")))

        # Create a Select object
        select = Select(rate_limit_select_elem)

        # Loop through each option and select it
        for option in select.options:
            value = option.get_attribute("value")
            select.select_by_value(value)
            time.sleep(1)
            
        # Select a specific option, e.g., "Unlimited"
        select.select_by_value("Unlimited")
        time.sleep(1)

        add_account_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAccountButton"))
        )
        self.assertIsNotNone(add_account_button, "Add Account confirm button can be clicked")
        add_account_button.click()
        
        time.sleep(2)
        
        # Wait until the select element is present
        account_select_elem = self.wait.until(EC.presence_of_element_located((By.ID, "accountSelect")))

        # Create a Select object
        select = Select(account_select_elem)

        # Loop through each option and select it
        for option in select.options:
            value = option.get_attribute("value")
            select.select_by_value(value)
            time.sleep(1)
        
        # Hover over the Account Rate Limit Hover
        account_rate_limit_hover = self.wait.until(EC.presence_of_all_elements_located((By.ID, "accountRateLimitHover")))
        ActionChains(self.driver).move_to_element(account_rate_limit_hover[-1]).perform()
        time.sleep(2)  # Give time for the edit button

        # Click the edit button
        edit_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "editRate"))
        )
        edit_button[-1].click()
        
        time.sleep(2)
        
        rate_limit_select_elem = self.wait.until(EC.presence_of_all_elements_located((By.ID, "rateLimitType")))
        
        # Create a Select object
        select = Select(rate_limit_select_elem[-1])
        
        # Select a specific option, e.g., "Monthly"
        select.select_by_value("Monthly")
        time.sleep(2)
        
        # Enter the amount in the Rate Limit Input Field
        rate_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "rateLimitAmount"))
        )
        rate_field.clear()
        rate_field.send_keys("1000")
        
        time.sleep(2)
        
        # Test the Cancel Changes
        discard_change_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "discardChange"))
        )
        self.assertIsNotNone(discard_change_button, "Cancel Rate Limit Change button can be clicked")
        discard_change_button.click()
        
        # Hover over the Account Rate Limit Hover
        account_rate_limit_hover = self.wait.until(EC.presence_of_all_elements_located((By.ID, "accountRateLimitHover")))
        ActionChains(self.driver).move_to_element(account_rate_limit_hover[-1]).perform()
        time.sleep(1)  # Give time for the edit button

        # Click the edit button
        edit_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "editRate"))
        )
        edit_button[-1].click()
        
        time.sleep(2)
        
        rate_limit_select_elem = self.wait.until(EC.presence_of_all_elements_located((By.ID, "rateLimitType")))
        
        # Create a Select object
        select = Select(rate_limit_select_elem[-1])
        
        # Select a specific option, e.g., "Hourly"
        select.select_by_value("Hourly")
        time.sleep(2)
        
        # Enter the amount in the Rate Limit Input Field
        rate_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "rateLimitAmount"))
        )
        rate_field.clear()
        rate_field.send_keys("50")
        
        time.sleep(2)
        
        # Test the Confirm Changes
        confirm_change_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmChange"))
        )
        self.assertIsNotNone(confirm_change_button, "Confirm Rate Limit Change button can be clicked")
        confirm_change_button.click()
        
        time.sleep(3)
        
        # Test the Delete Account
        delete_account_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "deleteAccount"))
        )
        print(delete_account_button)
        self.assertIsNotNone(delete_account_button, "Delete Account button can be clicked")
        delete_account_button[-1].click()
        
        time.sleep(2)
        
        # Test the Confirm Changes
        cancel_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "confirmationButton"))
        )
        self.assertTrue(cancel_button, "Cancel button can be clicked")
        cancel_button[0].click()
        
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

    # ----------------- Test Manage Account Name Must be Unique -----------------
    """Create Multiple Accounts and ensure that there's a case to make sure no two account names
       are the same."""
    def test_multiple_and_duplicate_accounts(self):
        
        self.settings_manage_accounts()
        
        time.sleep(10) # Manage Accounts maximum load time
        
        account_name_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "accountNameInput"))
        )
        account_name_field.clear()
        account_name_field.send_keys("Hollow Knight")
        
        time.sleep(2)
        
        coa_string_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "coaStringInput"))
        )
        coa_string_field.clear()
        coa_string_field.send_keys("Chick-Fil-A Sauce")
        
        time.sleep(2)
        
        add_account_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAccountButton"))
        )
        self.assertIsNotNone(add_account_button, "Add Account confirm button can be clicked")
        add_account_button.click()
        
        time.sleep(2)
        
        account_name_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "accountNameInput"))
        )
        account_name_field.clear()
        account_name_field.send_keys("Hollow Knight")
        
        time.sleep(2)
        
        coa_string_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "coaStringInput"))
        )
        coa_string_field.clear()
        coa_string_field.send_keys("Chick-Fil-A Chicken Sandwich")
        
        time.sleep(2)
        
        add_account_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAccountButton"))
        )
        self.assertIsNotNone(add_account_button, "Add Account confirm button can be clicked")
        add_account_button.click()
        
        time.sleep(2)

        # JavaScript Prompt Alert doesn't allow for Accounts with multiple names
        
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
        
        account_name_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "accountNameInput"))
        )
        account_name_field.clear()
        account_name_field.send_keys("Hornet")
        
        time.sleep(2)
        
        add_account_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAccountButton"))
        )
        self.assertIsNotNone(add_account_button, "Add Account confirm button can be clicked")
        add_account_button.click()
        
        time.sleep(2)
    
        # Test the Confirm Changes
        cancel_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "confirmationButton"))
        )
        self.assertTrue(cancel_button, "Cancel button can be clicked")
        cancel_button[0].click()
        
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
        
        
    """This test is only to be run a limited number of times as to not fill up the hot bar with
       a ton of API Keys"""
    # # ----------------- Test API Features in Accounts Tab -----------------
    # def test_api_features(self):
        
    #     self.settings_manage_accounts()
        
    #     time.sleep(10) # Manage Accounts maximum load time
        
    #     account_name_field = self.wait.until(
    #         EC.presence_of_element_located((By.ID, "accountNameInput"))
    #     )
    #     account_name_field.clear()
    #     account_name_field.send_keys("Hollow Knight")
        
    #     time.sleep(2)
        
    #     coa_string_field = self.wait.until(
    #         EC.presence_of_element_located((By.ID, "coaStringInput"))
    #     )
    #     coa_string_field.clear()
    #     coa_string_field.send_keys("Chick-Fil-A Sauce")
        
    #     time.sleep(2)
        
    #     add_account_button = self.wait.until(
    #         EC.element_to_be_clickable((By.ID, "addAccountButton"))
    #     )
    #     self.assertIsNotNone(add_account_button, "Add Account confirm button can be clicked")
    #     add_account_button.click()
        
    #     time.sleep(2)
        
    #     api_tab_button = self.wait.until(
    #         EC.element_to_be_clickable((By.ID, "apiTab"))
    #     )
    #     self.assertIsNotNone(api_tab_button, "API Tab button can be clicked")
    #     api_tab_button.click()
        
    #     time.sleep(2)
        
    #     account_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "accountModalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", account_scroll_window)
        
    #     time.sleep(2)
        
    #     create_api_key_button = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent")))
    #     self.assertIsNotNone(create_api_key_button, "Create API Key Expand Button should be present")
    #     create_api_key_button.click()
        
    #     time.sleep(2)
        
    #     account_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "accountModalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", account_scroll_window)
        
    #     time.sleep(2)
        
    #     application_name_field = self.wait.until(
    #         EC.presence_of_element_located((By.ID, "applicationName"))
    #     )
    #     application_name_field.clear()
    #     application_name_field.send_keys("THK")
        
    #     time.sleep(2)
        
    #     # Depricate Email stuff for now, It doesn't work with "For System Use"
    #     # expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
    #     # self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
    #     # expand_buttons[1].click() # Click the second one "Add Delegate"
         
    #     # email_input_field = self.wait.until(
    #     #     EC.presence_of_element_located((By.ID, "emailInput"))
    #     # )
    #     # email_input_field.clear()
    #     # email_input_field.send_keys("THK@email.com")
        
    #     # expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
    #     # self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
    #     # expand_buttons[1].click() # Click the second one "Add Delegate"
        
    #     # time.sleep(2)
        
    #     application_description_field = self.wait.until(
    #         EC.presence_of_element_located((By.ID, "applicationDescription"))
    #     )
    #     application_description_field.clear()
    #     application_description_field.send_keys("The Hollow Knight is a silent, vessel-like being created to contain the Infection within Hallownest, chosen for its supposed lack of will and emotion, but ultimately flawed due to its lingering bonds.")
        
    #     time.sleep(2)
        
    #     account_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "accountModalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", account_scroll_window)
        
    #     time.sleep(2)
        
    #     system_use_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='SystemUse']")))
    #     system_use_check.click()
        
    #     time.sleep(2)
        
    #     expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
    #     self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
    #     expand_buttons[-1].click() # Click the second one "Add Delegate"
        
    #     time.sleep(2)
        
    #     full_access_check_button = self.wait.until(EC.presence_of_element_located((By.ID, "fullAccessCheckbox")))
    #     self.assertIsNotNone(full_access_check_button, "Full Access Checkbox should be present and clicked")
    #     full_access_check_button.click() # Unchecks it all
        
    #     time.sleep(2)
        
    #     # checkbox_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "accessCheckboxes")))
    #     # self.assertIsNotNone(checkbox_buttons, "Checkboxes Buttons are visible should be present")
    #     # checkbox_buttons[0].click # Why did these not work??
    #     # time.sleep(1)
    #     # checkbox_buttons[1].click
    #     # time.sleep(1)
    #     # checkbox_buttons[2].click
    #     # time.sleep(1)
    #     # checkbox_buttons[3].click
    #     # time.sleep(1)
    #     # checkbox_buttons[4].click
        
    #     # full_access_check_button.click()
        
    #     # time.sleep(2)
        
    #     expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
    #     self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
    #     expand_buttons[-1].click() # Click the second one "Add Delegate"
        
    #     time.sleep(2) # id="createAPIKeyConfirm"
        
    #     create_key_button = self.wait.until(EC.presence_of_element_located((By.ID, "createAPIKeyConfirm")))
    #     self.assertIsNotNone(create_key_button, "Create API Key Confirm button should be present and clicked")
    #     create_key_button.click()
        
    #     time.sleep(2) # id="deactivateKeyButton"
        
    #     account_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "accountModalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", account_scroll_window)
        
    #     time.sleep(3)
        
    #     deactivate_key_button = self.wait.until(EC.presence_of_element_located((By.ID, "deactivateKeyButton")))
    #     self.assertIsNotNone(deactivate_key_button, "Deactivate Key should be present and clicked")
    #     deactivate_key_button.click()
        
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
        
    #     time.sleep(3)
        
    #     # Test the Confirm Changes
    #     cancel_button = self.wait.until(
    #         EC.element_to_be_clickable((By.ID, "cancel"))
    #     )
    #     self.assertIsNotNone(cancel_button, "Cancel button can be clicked")
    #     cancel_button.click()
        
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
        
    #     time.sleep(3)
        
        
    # ----------------- Test API Documentation View -----------------
    def test_api_documentation_view(self):
        
        self.settings_manage_accounts()
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in tabs if tab.text == "API Access"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'API Access' tab should be present")
        admin_supported_models_tab.click()
        time.sleep(5)
        
        time.sleep(2)
        
        # id="amplifyDocumentationButton"
        
        amplify_documentation_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "amplifyDocumentationButton"))
        )
        self.assertIsNotNone(amplify_documentation_button, "API Tab button can be clicked")
        amplify_documentation_button.click()
        
        time.sleep(10) # Load API documentation
        
        # id="viewAmplifyAPI"
        # id="downloadsAPI"
        
        view_api_tab = self.wait.until(
            EC.element_to_be_clickable((By.ID, "viewAmplifyAPI"))
        )
        self.assertIsNotNone(view_api_tab, "View API Tab button can be clicked")
        
        time.sleep(5)
        
        download_api_tab = self.wait.until(
            EC.element_to_be_clickable((By.ID, "downloadsAPI"))
        )
        self.assertIsNotNone(download_api_tab, "Download API Tab button can be clicked")
        download_api_tab.click()
        
        time.sleep(2)
        
        # id="downloadsAPITabTitle"
        
        download_api_tab_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "downloadsAPITabTitle"))
        )
        self.assertIsNotNone(download_api_tab_title, "Download API Tab Title can be is visible")
        
        download_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "downloadButtons")))
        self.assertIsNotNone(download_buttons, "Download Buttons are visible should be present")
        
        # Confirm that there are exactly 3 buttons
        self.assertEqual(len(download_buttons), 3, f"Expected 3 download buttons, found {len(download_buttons)}")
        
        time.sleep(2)
        
        

if __name__ == "__main__":
    unittest.main(verbosity=2)