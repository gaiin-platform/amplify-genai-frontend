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


class SettingsModalTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    
    # ----------------- Setup Test Data ------------------
    def settings_settings(self):

        time.sleep(5)

        user_menu = self.wait.until(EC.presence_of_element_located((By.ID, "userMenu")))
        self.assertTrue(user_menu, "User Menu button is present")
        user_menu.click()
        time.sleep(3)

        settings_select = self.wait.until(EC.presence_of_element_located((By.ID, "settingsInterface")))
        self.assertTrue(settings_select, "The Settings button should be present")
        settings_select.click()
        time.sleep(7)

        settings_modal_element = self.wait.until(EC.presence_of_element_located((By.ID, "modalTitle")))
        self.assertTrue(settings_modal_element.is_displayed(), "Settings window element is visible")
        modal_text = settings_modal_element.text
        self.assertEqual(modal_text, "Settings", "Modal title should be 'Settings'")
        time.sleep(2)
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in tabs if tab.text == "Configurations"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Configurations' tab should be present")
        admin_supported_models_tab.click()
        time.sleep(5)
    
    # ----------------- Test Settings Theme -----------------
    def test_settings_theme(self):
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)

        # Find both radio buttons by ID
        dark_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "themedark")))
        light_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "themelight")))

        # Get the input elements inside each label
        dark_radio = dark_mode_label.find_element(By.CSS_SELECTOR, "input[type='radio']")

        # Check which one is currently selected
        if dark_radio.is_selected():
            print("Dark mode is currently selected. Switching to Light mode...")
            time.sleep(1)
            light_mode_label.click()
        else:
            print("Light mode is currently selected. Switching to Dark mode...")
            time.sleep(1)
            dark_mode_label.click()

        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        # Potential alert is present
        try:
            alert = self.driver.switch_to.alert
            print("Alert found. Accepting...")
            time.sleep(1)
            alert.accept()
            time.sleep(2)
        except NoAlertPresentException:
            print("No alert present.")
            
        time.sleep(5)
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)

        # Find both radio buttons by ID
        dark_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "themedark")))
        light_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "themelight")))

        # Get the input elements inside each label
        dark_radio = dark_mode_label.find_element(By.CSS_SELECTOR, "input[type='radio']")

        # Check which one is currently selected
        if dark_radio.is_selected():
            print("Dark mode is currently selected. Switching to Light mode...")
            time.sleep(1)
            light_mode_label.click()
        else:
            print("Light mode is currently selected. Switching to Dark mode...")
            time.sleep(1)
            dark_mode_label.click()

        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        # Potential alert is present
        try:
            alert = self.driver.switch_to.alert
            print("Alert found. Accepting...")
            time.sleep(1)
            alert.accept()
            time.sleep(2)
        except NoAlertPresentException:
            print("No alert present.")
            
        time.sleep(5)
        
    # ----------------- Test Settings Models -----------------
    def test_settings_models(self):
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)
        
        openai_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allOpenAI']")))
        self.assertTrue(openai_check, "OpenAi is visible and clickable")
        
        time.sleep(2)
        
        claude_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allClaude']")))
        claude_check.click()
        
        time.sleep(2)
        
        mistral_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allMistral']")))
        mistral_check.click()
        
        time.sleep(2)
        
        amazon_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allAmazon']")))
        amazon_check.click()
        
        time.sleep(2)
        
        meta_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allMeta']")))
        meta_check.click()
        
        time.sleep(2)
        
        deepseek_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allDeepSeek']")))
        deepseek_check.click()
        
        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        # Potential alert is present
        try:
            alert = self.driver.switch_to.alert
            print("Alert found. Accepting...")
            time.sleep(1)
            alert.accept()
            time.sleep(2)
        except NoAlertPresentException:
            print("No alert present.")
        
        # Click the Model Select Button
        model_select_button = self.wait.until(EC.presence_of_element_located((By.ID, "modelSelect")))
        self.assertTrue(model_select_button.is_displayed(), "Model Select Button is visible")
        
        # Open the model dropdown
        model_select_button.click()
        
        time.sleep(1)

        gpt_four_one_mini_present = self.wait.until(EC.presence_of_element_located((By.ID, "gpt-4.1-mini")))
        self.assertTrue(gpt_four_one_mini_present.is_displayed(), "gpt-4.1-mini Button is visible")
        
        gpt_four_o_present = self.wait.until(EC.presence_of_element_located((By.ID, "gpt-4o")))
        self.assertTrue(gpt_four_o_present.is_displayed(), "gpt-4o Button is visible")
        
        gpt_four_o_mini_present = self.wait.until(EC.presence_of_element_located((By.ID, "gpt-4o-mini")))
        self.assertTrue(gpt_four_o_mini_present.is_displayed(), "gpt-4o-mini Button is visible")
        
        gpt_o_one_mini_present = self.wait.until(EC.presence_of_element_located((By.ID, "o1-mini")))
        self.assertTrue(gpt_o_one_mini_present.is_displayed(), "o1-mini Button is visible")
        
        gpt_o_one_preview_present = self.wait.until(EC.presence_of_element_located((By.ID, "o1-preview")))
        self.assertTrue(gpt_o_one_preview_present.is_displayed(), "o1-preview Button is visible")
        
        time.sleep(5)
        
        # Reset the settings
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)
        
        openai_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allOpenAI']")))
        
        time.sleep(2)
        
        claude_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allClaude']")))
        claude_check.click()
        
        time.sleep(2)
        
        mistral_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allMistral']")))
        mistral_check.click()
        
        time.sleep(2)
        
        amazon_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allAmazon']")))
        amazon_check.click()
        
        time.sleep(2)
        
        meta_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allMeta']")))
        meta_check.click()
        
        time.sleep(2)
        
        deepseek_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='modelOptionFlags-allDeepSeek']")))
        deepseek_check.click()
        
        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        # Potential Alert is present
        try:
            alert = self.driver.switch_to.alert
            print("Alert found. Accepting...")
            time.sleep(1)
            alert.accept()
            time.sleep(2)
        except NoAlertPresentException:
            print("No alert present.")
        
        # Click the Model Select Button
        model_select_button = self.wait.until(EC.presence_of_element_located((By.ID, "modelSelect")))
        self.assertTrue(model_select_button.is_displayed(), "Model Select Button is visible")
        
        # Open the model dropdown
        model_select_button.click()
        
        time.sleep(5)
        
    
    # ----------------- Test Settings Features -----------------
    def test_settings_features(self):
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)
        
        includeArtifacts_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeArtifacts']")))
        includeArtifacts_check.click()
        
        time.sleep(2)
        
        includeFocusedMessages_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeFocusedMessages']")))
        includeFocusedMessages_check.click()
        time.sleep(1)
        includeFocusedMessages_check.click()
        
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        settings_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", settings_scroll_window)
        
        time.sleep(2)
        
        includePluginSelector_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includePluginSelector']")))
        includePluginSelector_check.click()
        time.sleep(1)
        includePluginSelector_check.click()
        
        time.sleep(2)
        
        includeHighlighter_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeHighlighter']")))
        includeHighlighter_check.click()
        
        time.sleep(2)
        
        includeMemory_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeMemory']")))
        includeMemory_check.click()
        
        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        # Potential Alert is present
        try:
            alert = self.driver.switch_to.alert
            print("Alert found. Accepting...")
            time.sleep(1)
            alert.accept()
            time.sleep(2)
        except NoAlertPresentException:
            print("No alert present.")
            
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
                if span_element.text.strip() == "Memory":
                    target_button = button
                    break
            except:
                continue

        self.assertIsNotNone(target_button, "The 'Memory' button should be present")
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)
        
        includeArtifacts_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeArtifacts']")))
        includeArtifacts_check.click()
        
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        settings_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", settings_scroll_window)
        
        time.sleep(2)
        
        includeHighlighter_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeHighlighter']")))
        includeHighlighter_check.click()
        
        time.sleep(2)
        
        includeMemory_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='featureOptionFlags-includeMemory']")))
        includeMemory_check.click()
        
        time.sleep(2)
        
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Save", button_texts, "Save button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(5) # Wait for the load
        
        # Potential Alert is present
        try:
            alert = self.driver.switch_to.alert
            print("Alert found. Accepting...")
            time.sleep(1)
            alert.accept()
            time.sleep(2)
        except NoAlertPresentException:
            print("No alert present.")
            
        time.sleep(5)
    
    # ----------------- Test Settings Conversation Storage -----------------
    def test_settings_conversation_storage(self):
        
        self.settings_settings()
        
        # Sleep to allow the page to load or stabilize
        time.sleep(2)
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabName'")
        conversation_storage_tab = next((tab for tab in tabs if tab.text == "Conversation Storage"), None)
        self.assertIsNotNone(conversation_storage_tab, "The 'Conversation Storage' tab should be present")
        conversation_storage_tab.click()
        time.sleep(2)
        
        local_only_check = self.wait.until(EC.presence_of_element_located((By.ID, "local-only")))
        self.assertIsNotNone(local_only_check, "Store all existing and new conversations locally should be initialized and clickable")
        
        # Click the parent label
        local_only_label = local_only_check.find_element(By.XPATH, "./ancestor::label")
        local_only_label.click()
        
        time.sleep(2)
        
        future_local_check = self.wait.until(EC.presence_of_element_located((By.ID, "future-local")))
        self.assertIsNotNone(future_local_check, "Store only new conversations locally should be initialized and clickable")
        
        # Click the parent label
        future_local_label = future_local_check.find_element(By.XPATH, "./ancestor::label")
        future_local_label.click()
        
        time.sleep(2)
        
        cloud_only_check = self.wait.until(EC.presence_of_element_located((By.ID, "cloud-only")))
        self.assertIsNotNone(cloud_only_check, "Store all existing and new conversations in the cloud should be initialized and clickable")
        
        # Click the parent label
        cloud_only_label = cloud_only_check.find_element(By.XPATH, "./ancestor::label")
        cloud_only_label.click()
        
        time.sleep(2)
        
        future_cloud_check = self.wait.until(EC.presence_of_element_located((By.ID, "future-cloud")))
        self.assertIsNotNone(future_cloud_check, "Store only new conversations in the cloud should be initialized and clickable")

        # Click the parent label
        future_cloud_label = future_cloud_check.find_element(By.XPATH, "./ancestor::label")
        future_cloud_label.click()
        
        time.sleep(2)
        
        applyConversationStorage_check = self.wait.until(EC.element_to_be_clickable((By.ID, "applyConversationStorage")))
        self.assertIsNotNone(applyConversationStorage_check, "Apply Conversation Storage should be initialized and clickable")
        
        future_local_check = self.wait.until(EC.presence_of_element_located((By.ID, "future-local")))
        self.assertIsNotNone(future_local_check, "Store only new conversations locally should be initialized and clickable")
        
        # Click the parent label
        future_local_label = future_local_check.find_element(By.XPATH, "./ancestor::label")
        future_local_label.click()
        
        time.sleep(2)
        
        # Test the Confirm Changes
        cancel_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "confirmationButton"))
        )
        self.assertTrue(cancel_button, "Cancel button can be clicked")
        cancel_button[0].click()
        
        time.sleep(5)
        


if __name__ == "__main__":
    unittest.main(verbosity=2)
