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


class ScheduledTasksModalTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=False)
        
    def settings_setup(self):
        time.sleep(5)

        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")
        settings_tab.click()

        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")

        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Scheduled Tasks":
                    target_button = button
                    break
            except:
                continue 

        self.assertIsNotNone(target_button, "The 'Scheduled Tasks' button should be present")
        target_button.click()
        time.sleep(2)
        
    # ----------------- Test Presence -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""

    def test_settings_export_conversations(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        # --- Clickable buttons ---
        add_new_task_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addNewTask")))
        self.assertTrue(add_new_task_btn, "addNewTask should be clickable")

        expand_understanding_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "expandComponent-Understanding Scheduled Tasks")))
        self.assertTrue(expand_understanding_btn, "expandComponent-Understanding Scheduled Tasks should be clickable")

        expand_configure_time_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_configure_time_btn, "expandComponent-Configure Scheduled Time should be clickable")

        # --- Inputs / textareas ---
        task_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskNameInput")))
        task_name_input.send_keys("Project Hail Mary")
        self.assertTrue(task_name_input, "taskNameInput should accept input")

        description_input = self.wait.until(EC.presence_of_element_located((By.ID, "descriptionInput")))
        description_input.send_keys("Mission to stop Astrophage")
        self.assertTrue(description_input, "descriptionInput should accept input")

        task_instructions_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskInstructionsInput")))
        task_instructions_input.send_keys("Save Earth")
        self.assertTrue(task_instructions_input, "taskInstructionsInput should accept input")

        # --- Select elements ---
        scheduled_time_select = self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect")))
        self.assertTrue(scheduled_time_select, "scheduledTimeSelect should be present")

        hour_select = self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect")))
        self.assertTrue(hour_select, "hourSelect should be present")

        minute_select = self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect")))
        self.assertTrue(minute_select, "minuteSelect should be present")

        task_type_select = self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect")))
        self.assertTrue(task_type_select, "taskTypeSelect should be present")

        auto_populate_select = self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect")))
        self.assertTrue(auto_populate_select, "autoPopulateSelect should be present")

        # --- Checkbox inputs ---
        enable_date_range = self.wait.until(EC.presence_of_element_located((By.ID, "enableDateRange")))
        self.assertTrue(enable_date_range, "enableDateRange checkbox should be present")

        active_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "activeCheckbox")))
        self.assertTrue(active_checkbox, "activeCheckbox checkbox should be present")

        notify_completion_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "notifyCompletionCheckbox")))
        self.assertTrue(notify_completion_checkbox, "notifyCompletionCheckbox checkbox should be present")

        notify_failure_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "notifyFailureCheckbox")))
        self.assertTrue(notify_failure_checkbox, "notifyFailureCheckbox checkbox should be present")

        # --- Input text fields ---
        tag_input = self.wait.until(EC.presence_of_element_located((By.ID, "tagInput")))
        tag_input.send_keys("test tag")
        self.assertTrue(tag_input, "tagInput should accept input")

        email_input = self.wait.until(EC.presence_of_element_located((By.ID, "emailInput")))
        email_input.send_keys("test@email.com")
        self.assertTrue(email_input, "emailInput should accept input")

        # --- Confirmation buttons ---
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
    # ----------------- Test Presence -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""

    def test_settings_export_conversations(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        
if __name__ == "__main__":
    unittest.main(verbosity=2)
