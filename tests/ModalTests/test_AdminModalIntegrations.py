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
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Integrations"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Integrations' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)
    
    # ----------------- Test Integrations Google -----------------
    def test_presence_of_integrations_google(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[0].click() # Open the "Google"
        
        time.sleep(2)
        
        integrations_client_id_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='integrations-client_id']")))
        self.assertIsNotNone(integrations_client_id_label, "Integrations client id should be present")
        
        integrations_client_secret_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='integrations-client_secret']")))
        self.assertIsNotNone(integrations_client_secret_label, "Integrations client secret should be present")
        
        integrations_client_tenant_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='integrations-tenant_id']")))
        self.assertIsNotNone(integrations_client_tenant_label, "Integrations tenant id should be present")
        
        integration_id_google_calendar = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_calendar"))
        )
        self.assertIsNotNone(integration_id_google_calendar, "Integration id google calendar should be present")
        
        integration_id_google_sheets = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_sheets"))
        )
        self.assertIsNotNone(integration_id_google_sheets, "Integration id google sheets should be present")
        
        integration_id_google_docs = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_docs"))
        )
        self.assertIsNotNone(integration_id_google_docs, "Integration id google docs should be present")
        
        integration_id_google_drive = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_drive"))
        )
        self.assertIsNotNone(integration_id_google_drive, "Integration id google drive should be present")
        
        integration_id_google_forms = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_forms"))
        )
        self.assertIsNotNone(integration_id_google_forms, "Integration id google forms should be present")
        
        integration_id_google_gmail = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_gmail"))
        )
        self.assertIsNotNone(integration_id_google_gmail, "Integration id google gmail should be present")
        
        integration_id_google_contacts = self.wait.until(
            EC.presence_of_element_located((By.ID, "google_contacts"))
        )
        self.assertIsNotNone(integration_id_google_contacts, "Integration id google contacts should be present")
        
    # ----------------- Test Integrations Microsoft -----------------
    def test_presence_of_integrations_microsoft(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        expand_buttons[-1].click() # Open the "Microsoft"
        
        time.sleep(2)
        
        integrations_client_id_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='integrations-client_id']")))
        self.assertIsNotNone(integrations_client_id_label, "Integrations client id should be present")
        
        integrations_client_secret_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='integrations-client_secret']")))
        self.assertIsNotNone(integrations_client_secret_label, "Integrations client secret should be present")
        
        integrations_client_tenant_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='integrations-tenant_id']")))
        self.assertIsNotNone(integrations_client_tenant_label, "Integrations tenant id should be present")
        
        integration_id_microsoft_calendar = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_calendar"))
        )
        self.assertIsNotNone(integration_id_microsoft_calendar, "Integration id microsoft calendar should be present")
        
        integration_id_microsoft_drive = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_drive"))
        )
        self.assertIsNotNone(integration_id_microsoft_drive, "Integration id microsoft drive should be present")
        
        integration_id_microsoft_excel = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_excel"))
        )
        self.assertIsNotNone(integration_id_microsoft_excel, "Integration id microsoft excel should be present")
        
        integration_id_microsoft_onenote = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_onenote"))
        )
        self.assertIsNotNone(integration_id_microsoft_onenote, "Integration id microsoft onenote should be present")
        
        integration_id_microsoft_outlook = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_outlook"))
        )
        self.assertIsNotNone(integration_id_microsoft_outlook, "Integration id microsoft outlook should be present")
        
        integration_id_microsoft_word = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_word"))
        )
        self.assertIsNotNone(integration_id_microsoft_word, "Integration id microsoft word should be present")
        
        integration_id_microsoft_planner = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_planner"))
        )
        self.assertIsNotNone(integration_id_microsoft_planner, "Integration id microsoft planner should be present")
        
        integration_id_microsoft_sharepoint = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_sharepoint"))
        )
        self.assertIsNotNone(integration_id_microsoft_sharepoint, "Integration id microsoft sharepoint should be present")
        
        integration_id_microsoft_teams = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_teams"))
        )
        self.assertIsNotNone(integration_id_microsoft_teams, "Integration id microsoft teams should be present")
        
        integration_id_microsoft_contacts = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_contacts"))
        )
        self.assertIsNotNone(integration_id_microsoft_contacts, "Integration id microsoft contacts should be present")
        
        integration_id_microsoft_user_groups = self.wait.until(
            EC.presence_of_element_located((By.ID, "microsoft_user_groups"))
        )
        self.assertIsNotNone(integration_id_microsoft_user_groups, "Integration id microsoft user groups should be present")

    # ----------------- Test Reload Button -----------------
    def test_presence_of_reload_interface_button(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        reload_interface_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "adminModalReloadButton"))
        )
        self.assertIsNotNone(reload_interface_button, "Reolad Interface Button should be present")
        
        time.sleep(5)
        
        expand_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertIsNotNone(expand_buttons, "Expand Buttons are visible should be present")
        
    
    
if __name__ == "__main__":
    unittest.main(verbosity=2)