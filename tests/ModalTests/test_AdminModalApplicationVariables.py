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
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Application Variables"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Application Variables' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)

    
    # id="adminModalReloadButton"
    
    # ----------------- Test Application Variables Features Present -----------------
    def test_manage_account_features(self):
        
        self.settings_admin_interface()
        
        app_secrets_cognito = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationSecrets-COGNITO_CLIENT_SECRET']")))
        self.assertIsNotNone(app_secrets_cognito, "Application Secrets-COGNITO_CLIENT_SECRET should be present")
        
        app_secrets_nextauth = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationSecrets-NEXTAUTH_SECRET']")))
        self.assertIsNotNone(app_secrets_nextauth, "Application Secrets-NEXTAUTH_SECRET should be present")
        
        app_secrets_openai = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationSecrets-OPENAI_API_KEY']")))
        self.assertIsNotNone(app_secrets_openai, "Application Secrets-OPENAI_API_KEY should be present")
        
        app_secrets_gemini = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationSecrets-GEMINI_API_KEY']")))
        self.assertIsNotNone(app_secrets_gemini, "Application Secrets-GEMINI_API_KEY should be present")
        
        time.sleep(2)
        
        app_variables_default_function_call = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-DEFAULT_FUNCTION_CALL_MODEL']")))
        self.assertIsNotNone(app_variables_default_function_call, "Application Variables-DEFAULT_FUNCTION_CALL_MODEL should be present")
        
        app_variables_azure_deploy = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-AZURE_DEPLOYMENT_ID']")))
        self.assertIsNotNone(app_variables_azure_deploy, "Application Variables-AZURE_DEPLOYMENT_ID should be present")
        
        app_variables_openai_version = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-OPENAI_API_VERSION']")))
        self.assertIsNotNone(app_variables_openai_version, "Application Variables-OPENAI_API_VERSION should be present")
        
        app_variables_cognito_client = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-COGNITO_CLIENT_ID']")))
        self.assertIsNotNone(app_variables_cognito_client, "Application Variables-COGNITO_CLIENT_ID should be present")
        
        time.sleep(2)
        
        app_variables_available_models = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-AVAILABLE_MODELS']")))
        self.assertIsNotNone(app_variables_available_models, "Application Variables-AVAILABLE_MODELS should be present")
        
        app_variables_nextauth_secret = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-NEXTAUTH_SECRET']")))
        self.assertIsNotNone(app_variables_nextauth_secret, "Application Variables-NEXTAUTH_SECRET should be present")
        
        app_variables_openai_host = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-OPENAI_API_HOST']")))
        self.assertIsNotNone(app_variables_openai_host, "Application Variables-OPENAI_API_HOST should be present")
        
        app_variables_openai_type = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-OPENAI_API_TYPE']")))
        self.assertIsNotNone(app_variables_openai_type, "Application Variables-OPENAI_API_TYPE should be present")
        
        time.sleep(2)
        
        app_variables_azure_api_name = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-AZURE_API_NAME']")))
        self.assertIsNotNone(app_variables_azure_api_name, "Application Variables-AZURE_API_NAME should be present")
        
        app_variables_cognito_domain = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-COGNITO_DOMAIN']")))
        self.assertIsNotNone(app_variables_cognito_domain, "Application Variables-COGNITO_DOMAIN should be present")
        
        app_variables_cognito_issuer = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-COGNITO_ISSUER']")))
        self.assertIsNotNone(app_variables_cognito_issuer, "Application Variables-COGNITO_ISSUER should be present")
        
        app_variables_mixpanel_token = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-MIXPANEL_TOKEN']")))
        self.assertIsNotNone(app_variables_mixpanel_token, "Application Variables-MIXPANEL_TOKEN should be present")
        
        time.sleep(2)
        
        app_variables_chat_endpoint = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-CHAT_ENDPOINT']")))
        self.assertIsNotNone(app_variables_chat_endpoint, "Application Variables-CHAT_ENDPOINT should be present")
        
        app_variables_default_model = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-DEFAULT_MODEL']")))
        self.assertIsNotNone(app_variables_default_model, "Application Variables-DEFAULT_MODEL should be present")
        
        app_variables_api_base_url = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-API_BASE_URL']")))
        self.assertIsNotNone(app_variables_api_base_url, "Application Variables-API_BASE_URL should be present")
        
        app_variables_nextauth_url = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='applicationVariables-NEXTAUTH_URL']")))
        self.assertIsNotNone(app_variables_nextauth_url, "Application Variables-NEXTAUTH_URL should be present")
        
    # ----------------- Test Application Variables Reveal Button -----------------
    def test_show_and_hide_secret(self):
        
        self.settings_admin_interface()
        
        time.sleep(5)
        
        # id="showSecret"
        show_secret_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "showSecret"))
        )
        self.assertIsNotNone(show_secret_button, "Show Secret Button can be clicked")
        show_secret_button[0].click()
        
        time.sleep(5)
        
        # id="hideSecret"
        hide_secret_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "hideSecret"))
        )
        self.assertIsNotNone(hide_secret_button, "Show Secret Button can be clicked")
        hide_secret_button.click()
        
        time.sleep(5)


if __name__ == "__main__":
    unittest.main(verbosity=2)