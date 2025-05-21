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


class ManagCustomAPITests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=False)
        
    
    # ----------------- Setup Test Data ------------------
    def custom_function_api_setup(self):

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
                if span_element.text.strip() == "Custom Function APIs":
                    target_button = button
                    break
            except:
                continue

        self.assertIsNotNone(target_button, "The 'Custom Function APIs' button should be present")
        target_button.click()
        
        time.sleep(7)
    
    
    # ----------------- Test Manage Custom APIs -----------------
    def test_expected_endpoints(self):
        
        self.custom_function_api_setup()
        
        time.sleep(5)
        
        # id="addNewFunction"
        # id="expandApps"
        # id="closeModal"
        # id="functionNameInput"
        # id="addTagInput"
        # id="addTagButton"
        # id="addGroupInput"
        # id="addGroupButton"
        # id="textArea" Description
        # id="generateDescription" presence_of_all, Description
        # id="dependenciesInput"
        # id="codeEditor" textarea inside, presence of all, Python Code
        # id="generateDescription" presence of all, Python Code
        # id="tryItButton"
        # id="codeEditor" textarea inside, presence of all, JSON Schema
        # id="generateDescription" presence of all, JSON Schema
        
        # id="removeEnvironmentVariable"
        # id="selectVariable" Check for OAuth Token, Secret, Variable, Amplify Variable
        # id="keyInput" Input value
        # id="valueInput" Input value when Variable is selected
        # id="secretValueInput" Input value when Secret is selected 
        # id="amplifyVariableSelect" select value when Amplify Variable is selected
        # id="integrationsSelect" select value when OAuth Token is selected
        
        # id="addEnvironmentVariable"
        # id="testCaseNameInput"
        # id="testCaseDescriptionInput"
        # id="testCaseJSONInput"
        # id="exactCheck"
        # id="llmCheck"
        # id="subsetCheck"
        
        # id="expectedOutput"
        # id="addTestCase"
        # id="aiGenerateTestCase"
        # id="pathInput"
        # id="versionInput"
        # id="assistantAccessibleCheck"
        # id="accessSelect"
        # id="publishFunctionButton"
        
        

if __name__ == "__main__":
    unittest.main(verbosity=2)