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
    def settings_integrations_interface(self):

        time.sleep(5)

        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")
        settings_tab.click()

        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'",)
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Integrations":
                    target_button = button
                    break
            except:
                continue

        self.assertIsNotNone(target_button, "The 'Integrations' button should be present")
        target_button.click()
        
        time.sleep(7)
        
    # ----------------- Testing Integrations Modals Google -----------------
    def test_google_integrations_present(self):
        
        self.settings_integrations_interface()
        
        time.sleep(5)
        
        # presence_of_all_elements on id="tabName", extract text for each element with that id, add to list
        tab_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        tab_texts = [el.text.strip() for el in tab_elements]

        # make sure the list is ['Google', 'Microsoft']
        assert tab_texts == ['Google', 'Microsoft'], f"Expected ['Google', 'Microsoft'], but got {tab_texts}"

        time.sleep(2)

        # check for presence of all id="integrationsTitle", extract the text from each and add to list
        integration_title_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "integrationsTitle")))
        integration_titles = [el.text.strip() for el in integration_title_elements]

        expected_titles = ['Google Calendar', 'Google Sheets', 'Google Docs', 'Google Drive', 'Google Forms', 'Google Gmail', 'Google Contacts']
        
        self.assertEqual(integration_titles, expected_titles, "Expected titles equals integration titles")
        time.sleep(2)
        
    # ----------------- Testing Integrations Modals Microsoft -----------------
    def test_microsoft_integrations_present(self):
        
        self.settings_integrations_interface()
        
        time.sleep(5)
        
        # presence_of_all_elements on id="tabName", extract text for each element with that id, add to list
        tab_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        tab_texts = [el.text.strip() for el in tab_elements]

        # make sure the list is ['Google', 'Microsoft']
        assert tab_texts == ['Google', 'Microsoft'], f"Expected ['Google', 'Microsoft'], but got {tab_texts}"
        
        active_tab = self.wait.until(EC.presence_of_all_elements_located((By.ID, "activeTab")))
        active_tab[-1].click()

        time.sleep(2)

        # check for presence of all id="integrationsTitle", extract the text from each and add to list
        integration_title_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "integrationsTitle")))
        integration_titles = [el.text.strip() for el in integration_title_elements]
        
        print(integration_titles)

        expected_titles = ['Microsoft Calendar', 'Microsoft OneDrive', 'Microsoft Excel', 'Microsoft OneNote', 'Microsoft Outlook', 'Microsoft Word', 'Microsoft SharePoint', 'Microsoft Contacts']
        
        self.assertEqual(integration_titles, expected_titles, "Expected titles equals integration titles")
        time.sleep(2)